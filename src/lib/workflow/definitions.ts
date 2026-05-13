import type { WorkflowDefinitionBody } from '@/domain/workflow/types';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

const cache = new Map<string, { v: WorkflowDefinitionBody; loadedAt: number }>();
const TTL_MS = 60_000;

/**
 * Carga la definición activa del flujo `name` para una organización.
 * Cae a la definición global (org_id is null) si la org no tiene una propia.
 */
export async function loadDefinition(name: string, orgId: string | null): Promise<WorkflowDefinitionBody> {
  const key = `${orgId ?? 'global'}::${name}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.loadedAt < TTL_MS) return hit.v;

  const sb = createSupabaseServiceClient();
  let q = sb.from('workflow_definitions').select('body, version, org_id')
            .eq('name', name).eq('is_active', true)
            .order('version', { ascending: false }).limit(1);

  if (orgId) {
    // Buscar primero la específica de la org; si no hay, fallback global.
    const { data: orgDef } = await q.eq('org_id', orgId).maybeSingle();
    if (orgDef?.body) {
      cache.set(key, { v: orgDef.body as WorkflowDefinitionBody, loadedAt: Date.now() });
      return orgDef.body as WorkflowDefinitionBody;
    }
  }

  const { data, error } = await sb.from('workflow_definitions')
    .select('body, version').is('org_id', null)
    .eq('name', name).eq('is_active', true)
    .order('version', { ascending: false }).limit(1).maybeSingle();

  if (error || !data?.body) throw new Error(`Workflow ${name} no encontrado`);
  cache.set(key, { v: data.body as WorkflowDefinitionBody, loadedAt: Date.now() });
  return data.body as WorkflowDefinitionBody;
}

export function clearWorkflowCache() { cache.clear(); }
