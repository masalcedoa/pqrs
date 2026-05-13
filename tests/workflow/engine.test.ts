import { describe, it, expect } from 'vitest';
import { WorkflowEngine } from '@/lib/workflow/engine';
import type { WorkflowDefinitionBody, CaseSnapshot } from '@/domain/workflow/types';

const DEF: WorkflowDefinitionBody = {
  initial: 'radicado',
  terminal: ['cerrado', 'vencido'],
  transitions: [
    { from: 'radicado',      to: 'en_validacion', roles_allowed: ['agente','admin'] },
    { from: 'en_validacion', to: 'clasificado',   roles_allowed: ['agente','admin'], requires_fields: ['type','category'] },
    { from: 'clasificado',   to: 'asignado',      roles_allowed: ['supervisor','admin'], requires_fields: ['assigned_unit_id'] },
    { from: 'notificado',    to: 'en_recurso_reposicion', roles_allowed: ['ciudadano'], rules: ['within_reposition_window'] }
  ]
};

const baseSnap: CaseSnapshot = {
  id: 'c1', org_id: 'o1', status: 'radicado', type: 'reclamo', category: 'facturacion',
  assigned_unit_id: null, resolution_text: null, closed_at: null, notified_at: null, metadata: {}
};

describe('WorkflowEngine', () => {
  const engine = new WorkflowEngine(DEF, {});

  it('lista transiciones legales por rol', () => {
    const list = engine.availableTransitions(baseSnap, 'agente');
    expect(list.map(t => t.to)).toEqual(['en_validacion']);
  });

  it('valida transición permitida', () => {
    const r = engine.validate(baseSnap, { to: 'en_validacion', actor: { user_id: 'u', role: 'agente' } });
    expect(r.ok).toBe(true);
  });

  it('rechaza transición fuera del grafo', () => {
    const r = engine.validate(baseSnap, { to: 'cerrado', actor: { user_id: 'u', role: 'admin' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('workflow_error');
  });

  it('rechaza por rol no autorizado', () => {
    const r = engine.validate(baseSnap, { to: 'en_validacion', actor: { user_id: 'u', role: 'ciudadano' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('not_authorized');
  });

  it('requires_fields falla si falta campo', () => {
    const snap: CaseSnapshot = { ...baseSnap, status: 'clasificado' };
    const r = engine.validate(snap, { to: 'asignado', actor: { user_id: 'u', role: 'supervisor' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('validation_error');
  });

  it('requires_fields pasa si campo presente', () => {
    const snap: CaseSnapshot = { ...baseSnap, status: 'clasificado', assigned_unit_id: 'u1' };
    const r = engine.validate(snap, { to: 'asignado', actor: { user_id: 'u', role: 'admin' } });
    expect(r.ok).toBe(true);
  });

  it('regla within_reposition_window falla sin notified_at', () => {
    const snap: CaseSnapshot = { ...baseSnap, status: 'notificado' };
    const r = engine.validate(snap, { to: 'en_recurso_reposicion', actor: { user_id: 'u', role: 'ciudadano' } });
    expect(r.ok).toBe(false);
  });

  it('regla within_reposition_window pasa dentro de la ventana', () => {
    const recent = new Date(Date.now() - 1 * 86400000).toISOString();
    const snap: CaseSnapshot = { ...baseSnap, status: 'notificado', notified_at: recent };
    const r = engine.validate(snap, { to: 'en_recurso_reposicion', actor: { user_id: 'u', role: 'ciudadano' } });
    expect(r.ok).toBe(true);
  });
});
