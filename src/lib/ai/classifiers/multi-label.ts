import { anthropic, MODEL_FAST } from '@/lib/ai/agent';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

const SYSTEM = `
Eres un clasificador multi-etiqueta de PQRS del sector energía en Colombia.
Devuelve SOLO JSON con esta forma:
{
  "type":          "peticion|queja|reclamo|recurso_reposicion|recurso_apelacion|denuncia|solicitud_tecnica",
  "categories":    [array de 1..3 de: facturacion,lectura,consumo_elevado,suspension,reconexion,medidor,calidad_servicio,dano_electrico,atencion_usuario,cobros,otro],
  "subcategory":   "texto corto",
  "causal":        "texto corto que cite el motivo principal",
  "priority":      "baja|media|alta|critica",
  "requires_visit":boolean,
  "suggested_unit":"ATC|COM|TEC|JUR",
  "risk_regulatorio": "ninguno|bajo|medio|alto",
  "risk_fraude":      "ninguno|bajo|medio|alto",
  "confidence": número entre 0 y 1
}
Reglas:
- Cuando haya múltiples temas devuelve hasta 3 categorías ordenadas por importancia.
- "risk_regulatorio" alto si hay riesgo de incumplir SSPD o CREG.
- "risk_fraude" alto si hay pistas de manipulación de medidor, suplantación o cobro inflado intencional.
`;

export interface MultiLabel {
  type: string;
  categories: string[];
  subcategory: string;
  causal: string;
  priority: string;
  requires_visit: boolean;
  suggested_unit: 'ATC' | 'COM' | 'TEC' | 'JUR';
  risk_regulatorio: 'ninguno' | 'bajo' | 'medio' | 'alto';
  risk_fraude: 'ninguno' | 'bajo' | 'medio' | 'alto';
  confidence: number;
}

export async function classifyMultiLabel(narrative: string, ctx?: {
  caseId?: string; orgId?: string | null; userId?: string | null;
}): Promise<MultiLabel> {
  const started = Date.now();
  const msg = await anthropic.messages.create({
    model: MODEL_FAST,
    max_tokens: 600,
    system: SYSTEM,
    messages: [{ role: 'user', content: narrative }]
  });
  const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
  let parsed: MultiLabel;
  try { parsed = JSON.parse(text); }
  catch { throw new Error('classifyMultiLabel: respuesta no JSON'); }

  try {
    const sb = createSupabaseServiceClient();
    await sb.from('ai_interactions').insert({
      case_id: ctx?.caseId ?? null,
      org_id:  ctx?.orgId  ?? null,
      user_id: ctx?.userId ?? null,
      purpose: 'clasificar_multilabel',
      model: MODEL_FAST,
      prompt: narrative,
      response: text,
      input_tokens:  msg.usage?.input_tokens,
      output_tokens: msg.usage?.output_tokens,
      latency_ms:    Date.now() - started
    });
  } catch { /* best-effort */ }

  return parsed;
}
