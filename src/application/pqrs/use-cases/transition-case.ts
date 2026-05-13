import { z } from 'zod';
import { Err, Ok, Result, AppError, NotFoundError } from '@/domain/shared/result';
import type { PqrsStatus, UserRole } from '@/types/pqrs';
import { WorkflowEngine } from '@/lib/workflow/engine';
import { loadDefinition } from '@/lib/workflow/definitions';
import { sideEffects } from '@/lib/workflow/side-effects';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const TransitionInput = z.object({
  case_id: z.string().uuid(),
  to: z.string() as unknown as z.ZodType<PqrsStatus>,
  actor: z.object({
    user_id: z.string().uuid(),
    role: z.string() as unknown as z.ZodType<UserRole>
  }),
  reason: z.string().max(2000).optional(),
  payload: z.record(z.unknown()).optional()
});
export type TransitionInput = z.infer<typeof TransitionInput>;

export interface TransitionResult {
  case_id: string;
  from: PqrsStatus;
  to:   PqrsStatus;
  side_effects: { executed: string[]; failed: string[] };
}

/**
 * Caso de uso: ejecutar una transición de estado sobre un caso PQRS.
 * Orquesta: validación de input → carga snapshot → motor BPM → side-effects → bitácora.
 */
export async function transitionCase(input: TransitionInput): Promise<Result<TransitionResult>> {
  const parse = TransitionInput.safeParse(input);
  if (!parse.success) return Err(new AppError('validation_error', 'Input inválido', parse.error.flatten()));

  const sb = createSupabaseServiceClient();

  const { data: snap, error } = await sb.from('pqrs_cases')
    .select('*').eq('id', input.case_id).single();
  if (error || !snap) return Err(new NotFoundError('pqrs_case', input.case_id));

  const def = await loadDefinition('pqrs_default', snap.org_id);
  const engine = new WorkflowEngine(def, sideEffects);

  const prep = engine.prepareTransition(snap, {
    to: input.to, actor: input.actor, reason: input.reason, payload: input.payload
  });
  if (!prep.ok) return prep;

  // Persistir cambio + timeline en una sola op vía RPC (idealmente, sino dos calls)
  const fromStatus = snap.status as PqrsStatus;

  const { error: updErr } = await sb.from('pqrs_cases')
    .update({
      status: input.to,
      ...(input.to === 'notificado' ? { closed_at: new Date().toISOString() } : {}),
      metadata: { ...snap.metadata, last_transition_reason: input.reason ?? null }
    })
    .eq('id', input.case_id);
  if (updErr) return Err(new AppError('db_error', updErr.message));

  await sb.from('case_timeline').insert({
    case_id: input.case_id, org_id: snap.org_id,
    event_type: 'transition', actor_id: input.actor.user_id,
    payload: { from: fromStatus, to: input.to, reason: input.reason ?? null, ...input.payload }
  });

  // Side-effects (no críticos para devolver Ok)
  const se = await engine.runSideEffects(prep.value.sideEffects, {
    caseId: input.case_id, orgId: snap.org_id, actorId: input.actor.user_id, payload: input.payload
  });

  return Ok({ case_id: input.case_id, from: fromStatus, to: input.to, side_effects: se });
}
