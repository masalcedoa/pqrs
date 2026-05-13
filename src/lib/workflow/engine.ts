import type {
  CaseSnapshot, TransitionRequest, WorkflowDefinitionBody,
  WorkflowTransition, SideEffectName
} from '@/domain/workflow/types';
import { Err, Ok, Result, WorkflowError, NotAuthorizedError, ValidationError } from '@/domain/shared/result';
import { evaluateRules } from './rules';

export interface SideEffectCtx {
  caseId:    string;
  orgId:     string | null;
  actorId:   string;
  payload?:  Record<string, unknown>;
}

export type SideEffectHandler = (ctx: SideEffectCtx) => Promise<void>;

export class WorkflowEngine {
  constructor(
    private readonly definition: WorkflowDefinitionBody,
    private readonly sideEffects: Partial<Record<SideEffectName, SideEffectHandler>>
  ) {}

  /** Lista las transiciones legales para un caso dado un actor. */
  availableTransitions(snap: CaseSnapshot, actorRole: string): WorkflowTransition[] {
    return this.definition.transitions.filter(t =>
      t.from === snap.status && t.roles_allowed.includes(actorRole as never)
    );
  }

  /** Valida la transición sin ejecutarla. */
  validate(snap: CaseSnapshot, req: TransitionRequest): Result<WorkflowTransition> {
    const t = this.definition.transitions.find(x => x.from === snap.status && x.to === req.to);
    if (!t) return Err(new WorkflowError(`Transición ${snap.status} → ${req.to} no permitida`));

    if (!t.roles_allowed.includes(req.actor.role)) {
      return Err(new NotAuthorizedError(`Rol ${req.actor.role} no puede ejecutar ${snap.status} → ${req.to}`));
    }

    if (t.requires_fields?.length) {
      const missing = t.requires_fields.filter(f => {
        const v = (snap as Record<string, unknown>)[f];
        return v === null || v === undefined || v === '';
      });
      if (missing.length) {
        return Err(new ValidationError(`Faltan campos: ${missing.join(', ')}`, { missing }));
      }
    }

    const ruleResult = evaluateRules(t.rules, snap);
    if (!ruleResult.ok) return Err(new WorkflowError(ruleResult.reason ?? 'Reglas no satisfechas'));

    return Ok(t);
  }

  /**
   * Devuelve la transición válida + side-effects a ejecutar.
   * La persistencia la hace el caller (caso de uso) en una sola transacción.
   */
  prepareTransition(snap: CaseSnapshot, req: TransitionRequest): Result<{
    transition: WorkflowTransition;
    sideEffects: SideEffectName[];
  }> {
    const v = this.validate(snap, req);
    if (!v.ok) return v;
    return Ok({ transition: v.value, sideEffects: v.value.auto_side_effects ?? [] });
  }

  /** Ejecuta los side-effects registrados. Errores se loguean pero no abortan el flujo. */
  async runSideEffects(names: SideEffectName[], ctx: SideEffectCtx): Promise<{ executed: SideEffectName[]; failed: SideEffectName[] }> {
    const executed: SideEffectName[] = [];
    const failed:   SideEffectName[] = [];
    for (const name of names) {
      const h = this.sideEffects[name];
      if (!h) { failed.push(name); continue; }
      try { await h(ctx); executed.push(name); }
      catch { failed.push(name); }
    }
    return { executed, failed };
  }
}
