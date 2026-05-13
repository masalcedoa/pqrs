import type { SideEffectName } from '@/domain/workflow/types';
import type { SideEffectHandler } from './engine';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * Implementaciones de side-effects del workflow.
 * Cada handler es idempotente: si el efecto ya se aplicó (mismo case_id + tipo en timeline),
 * no duplica.
 */
async function alreadyApplied(caseId: string, kind: string): Promise<boolean> {
  const sb = createSupabaseServiceClient();
  const { count } = await sb.from('case_timeline')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', caseId)
    .eq('event_type', 'notification')
    .contains('payload', { kind });
  return (count ?? 0) > 0;
}

export const sideEffects: Record<SideEffectName, SideEffectHandler> = {
  notify_acknowledgement: async ({ caseId, orgId, actorId }) => {
    if (await alreadyApplied(caseId, 'ACUSE_RECIBO')) return;
    const sb = createSupabaseServiceClient();
    const { data: c } = await sb.from('pqrs_cases')
      .select('radicado, legal_term_days, customer_id').eq('id', caseId).single();
    const { data: cu } = c ? await sb.from('customers').select('email, phone, full_name').eq('id', c.customer_id).single() : { data: null };
    if (cu?.email) {
      await sb.from('notifications').insert({
        case_id: caseId, org_id: orgId, channel: 'email', recipient: cu.email,
        template: 'ACUSE_RECIBO',
        subject: `Acuse de recibo PQRS ${c?.radicado}`,
        body: `Confirmamos la recepción de su PQRS ${c?.radicado}. Responderemos en ${c?.legal_term_days ?? 15} días hábiles.`,
        payload: { kind: 'ACUSE_RECIBO', nombre: cu.full_name }
      });
    }
    await sb.from('case_timeline').insert({
      case_id: caseId, org_id: orgId, event_type: 'notification', actor_id: actorId,
      payload: { kind: 'ACUSE_RECIBO' }
    });
  },

  notify_request_info: async ({ caseId, orgId, actorId, payload }) => {
    const sb = createSupabaseServiceClient();
    await sb.from('case_timeline').insert({
      case_id: caseId, org_id: orgId, event_type: 'notification', actor_id: actorId,
      payload: { kind: 'PEDIR_INFO', ...payload }
    });
  },

  create_work_order: async ({ caseId, orgId, actorId, payload }) => {
    const sb = createSupabaseServiceClient();
    const type = (payload?.type as string) ?? 'visita_tecnica';
    const { data: wo } = await sb.from('work_orders').insert({
      case_id: caseId, org_id: orgId, type,
      description: (payload?.description as string) ?? 'Generada automáticamente por workflow',
      created_by: actorId, status: 'creada'
    }).select().single();
    await sb.from('case_timeline').insert({
      case_id: caseId, org_id: orgId, event_type: 'order_created', actor_id: actorId,
      payload: { work_order_id: wo?.id, order_number: wo?.order_number, type }
    });
  },

  dispatch_response: async ({ caseId, orgId, actorId }) => {
    const sb = createSupabaseServiceClient();
    const { data: c } = await sb.from('pqrs_cases')
      .select('radicado, resolution_text, customer_id').eq('id', caseId).single();
    const { data: cu } = c ? await sb.from('customers').select('email, full_name').eq('id', c.customer_id).single() : { data: null };
    if (cu?.email) {
      await sb.from('notifications').insert({
        case_id: caseId, org_id: orgId, channel: 'email', recipient: cu.email,
        template: 'RESPUESTA_NOTIFICADA',
        subject: `Respuesta a su PQRS ${c?.radicado}`,
        body: c?.resolution_text ?? '',
        payload: { kind: 'RESPUESTA', nombre: cu.full_name }
      });
    }
    await sb.from('pqrs_cases').update({ status: 'notificado', closed_at: new Date().toISOString() }).eq('id', caseId);
    await sb.from('case_timeline').insert({
      case_id: caseId, org_id: orgId, event_type: 'notification', actor_id: actorId,
      payload: { kind: 'RESPUESTA' }
    });
  },

  schedule_reposition_window: async ({ caseId, orgId, actorId }) => {
    const sb = createSupabaseServiceClient();
    const fireAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    await sb.from('case_reminders').insert({
      case_id: caseId, org_id: orgId, fire_at: fireAt, kind: 'reposition_window',
      payload: { source: 'workflow' }
    });
    await sb.from('case_timeline').insert({
      case_id: caseId, org_id: orgId, event_type: 'reminder', actor_id: actorId,
      payload: { kind: 'reposition_window', fire_at: fireAt }
    });
  },

  sspd_webhook: async ({ caseId, orgId, actorId }) => {
    const sb = createSupabaseServiceClient();
    // Encola; el dispatcher externo lo enviará al endpoint configurado por la org.
    await sb.from('notifications').insert({
      case_id: caseId, org_id: orgId, channel: 'email',          // se sobreescribe en dispatcher
      recipient: 'sspd_outbound', subject: 'SSPD escalamiento',
      body: 'Pendiente de envío', payload: { kind: 'SSPD_WEBHOOK' }
    });
    await sb.from('case_timeline').insert({
      case_id: caseId, org_id: orgId, event_type: 'notification', actor_id: actorId,
      payload: { kind: 'SSPD_WEBHOOK' }
    });
  },

  mark_overdue: async ({ caseId, orgId, actorId }) => {
    const sb = createSupabaseServiceClient();
    await sb.from('pqrs_cases').update({ status: 'vencido' }).eq('id', caseId);
    await sb.from('case_timeline').insert({
      case_id: caseId, org_id: orgId, event_type: 'overdue', actor_id: actorId,
      payload: { detected_at: new Date().toISOString() }
    });
  }
};
