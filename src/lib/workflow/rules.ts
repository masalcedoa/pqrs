import type { CaseSnapshot, RuleName, RuleResult } from '@/domain/workflow/types';

type Rule = (caseSnap: CaseSnapshot, now?: Date) => RuleResult;

const FIVE_BUSINESS_DAYS_MS = 5 * 24 * 60 * 60 * 1000; // aprox; en producción usar calendario hábil real.

export const rules: Record<RuleName, Rule> = {
  within_reposition_window: (c, now = new Date()) => {
    const notified = c.notified_at ? new Date(c.notified_at as string) : null;
    if (!notified) return { ok: false, reason: 'Caso aún no notificado' };
    const diff = now.getTime() - notified.getTime();
    if (diff > FIVE_BUSINESS_DAYS_MS) {
      return { ok: false, reason: 'La ventana de 5 días hábiles para reposición ha vencido' };
    }
    return { ok: true };
  },

  has_supervisor_approval: (c) => {
    const approvals = (c.metadata?.approvals ?? []) as Array<{ role: string; decision: string }>;
    const ok = approvals.some(a => a.role === 'supervisor' && a.decision === 'aprobado');
    return ok ? { ok: true } : { ok: false, reason: 'Falta aprobación del supervisor' };
  },

  has_juridico_dictamen: (c) => {
    const flags = (c.metadata ?? {}) as Record<string, unknown>;
    return flags.juridico_dictamen
      ? { ok: true }
      : { ok: false, reason: 'Falta dictamen jurídico' };
  },

  not_terminal: (c) => {
    return ['cerrado', 'vencido'].includes(c.status)
      ? { ok: false, reason: 'El caso ya está en estado terminal' }
      : { ok: true };
  }
};

export function evaluateRules(names: RuleName[] | undefined, snap: CaseSnapshot): RuleResult {
  if (!names || names.length === 0) return { ok: true };
  for (const n of names) {
    const rule = rules[n];
    if (!rule) return { ok: false, reason: `Regla desconocida: ${n}` };
    const r = rule(snap);
    if (!r.ok) return r;
  }
  return { ok: true };
}
