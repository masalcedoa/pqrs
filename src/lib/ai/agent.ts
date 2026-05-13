import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import type { PqrsCategory, PqrsPriority, PqrsType } from '@/types/pqrs';

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? 'mock' });
const MODEL_PRIMARY = process.env.ANTHROPIC_MODEL_PRIMARY ?? 'claude-opus-4-7';
const MODEL_FAST    = process.env.ANTHROPIC_MODEL_FAST    ?? 'claude-haiku-4-5-20251001';

export function isAiMockMode(): boolean {
  if (process.env.AI_MOCK_MODE === 'true') return true;
  return !process.env.ANTHROPIC_API_KEY;
}

export const SYSTEM_PROMPT_RADICACION = `
Eres el asistente virtual de PQRS de una empresa prestadora del servicio público de energía
eléctrica en Colombia. Tu objetivo es ayudar al usuario ciudadano a radicar correctamente
una PQRS conforme a la Ley 142 de 1994, Resolución CREG 108 de 1997 y lineamientos SSPD.

Reglas:
1. Mantén un tono claro, cordial y respetuoso. Habla en español de Colombia.
2. Solicita siempre y solo lo necesario para radicar: tipo de documento, número, nombre,
   número de cuenta contrato (si aplica), dirección de la prestación, descripción de la
   situación, periodo del reclamo, evidencia disponible.
3. Clasifica la solicitud en uno de estos tipos: peticion, queja, reclamo,
   recurso_reposicion, recurso_apelacion, denuncia, solicitud_tecnica.
4. Identifica la categoría (facturacion, lectura, consumo_elevado, suspension, reconexion,
   medidor, calidad_servicio, dano_electrico, atencion_usuario, cobros, otro).
5. Sugiere prioridad razonada (baja/media/alta/critica).
6. Cuando tengas los datos completos, llama a la tool "crear_radicado".
7. Nunca prometas decisiones favorables: solo informas el trámite y el término legal
   aplicable (general: 15 días hábiles, según causal y existencia de visita técnica).
8. Si la solicitud es claramente un recurso de reposición o apelación, indica al usuario
   los términos para interponerlos y los requisitos.
9. Si el usuario te insulta o usa lenguaje agresivo, mantén la compostura y continúa.
10. Nunca inventes normativa: si dudas, indica que verificarás y deriva al área jurídica.
`;

export const SYSTEM_PROMPT_CLASIFICAR = `
Eres un clasificador experto de PQRS del sector energía en Colombia. Recibirás el texto
narrativo de un ciudadano y debes devolver un JSON estricto con:
- type (peticion|queja|reclamo|recurso_reposicion|recurso_apelacion|denuncia|solicitud_tecnica)
- category (facturacion|lectura|consumo_elevado|suspension|reconexion|medidor|calidad_servicio|dano_electrico|atencion_usuario|cobros|otro)
- subcategory (texto corto)
- causal (texto corto)
- priority (baja|media|alta|critica)
- requires_visit (boolean)
- suggested_unit (ATC|COM|TEC|JUR)
- confidence (0..1)
Devuelve SOLO JSON, sin texto adicional.
`;

export interface Clasificacion {
  type: PqrsType;
  category: PqrsCategory;
  subcategory?: string;
  causal?: string;
  priority: PqrsPriority;
  requires_visit: boolean;
  suggested_unit: 'ATC' | 'COM' | 'TEC' | 'JUR';
  confidence: number;
}

function mockClassification(narrative: string): Clasificacion {
  const lower = narrative.toLowerCase();
  const category: PqrsCategory =
    /factur|cobr/.test(lower)        ? 'facturacion' :
    /consumo|kwh|kilovatio/.test(lower) ? 'consumo_elevado' :
    /medidor|sellos/.test(lower)     ? 'medidor' :
    /suspens/.test(lower)            ? 'suspension' :
    /reconex/.test(lower)            ? 'reconexion' :
    /apag[oó]n|fluct|cali/.test(lower) ? 'calidad_servicio' :
    'otro';
  return {
    type: /recurso/.test(lower) ? 'recurso_reposicion' : 'reclamo',
    category, subcategory: 'auto-mock', causal: 'auto-mock',
    priority: 'media', requires_visit: category === 'medidor' || category === 'consumo_elevado',
    suggested_unit: category === 'facturacion' ? 'COM' : category === 'medidor' ? 'TEC' : 'ATC',
    confidence: 0.5
  };
}

export async function clasificarPqrs(narrative: string, caseId?: string): Promise<Clasificacion> {
  const started = Date.now();
  let text = '';
  let parsed: Clasificacion;
  let usage: { input_tokens?: number; output_tokens?: number } = {};

  if (isAiMockMode()) {
    parsed = mockClassification(narrative);
    text = JSON.stringify(parsed);
  } else {
    const msg = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 600,
      system: SYSTEM_PROMPT_CLASIFICAR,
      messages: [{ role: 'user', content: narrative }]
    });
    text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    try { parsed = JSON.parse(text) as Clasificacion; }
    catch { parsed = mockClassification(narrative); }   // fallback robusto
    usage = { input_tokens: msg.usage?.input_tokens, output_tokens: msg.usage?.output_tokens };
  }

  try {
    const supabase = createSupabaseServiceClient();
    await supabase.from('ai_interactions').insert({
      case_id: caseId ?? null,
      purpose: 'clasificar',
      model: isAiMockMode() ? 'mock' : MODEL_FAST,
      prompt: narrative,
      response: text,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      latency_ms: Date.now() - started
    });
  } catch { /* best-effort */ }

  return parsed;
}

export async function redactarRespuesta(opts: {
  caseId: string;
  context: string;
  templateBody?: string;
}): Promise<string> {
  const started = Date.now();
  const sys = `
Eres redactor jurídico de PQRS del sector energía. Redacta una respuesta profesional,
clara y citando la normativa aplicable (Ley 142/94, CREG 108/97, SSPD, CCU vigente).
No prometas resultados. Sé conciso y formal. Si hay plantilla, úsala como base.
`;
  const userMsg = `Plantilla base (opcional):\n${opts.templateBody ?? '(sin plantilla)'}\n\nContexto del caso:\n${opts.context}`;
  const msg = await anthropic.messages.create({
    model: MODEL_PRIMARY,
    max_tokens: 1200,
    system: sys,
    messages: [{ role: 'user', content: userMsg }]
  });
  const text = msg.content[0].type === 'text' ? msg.content[0].text : '';

  const supabase = createSupabaseServiceClient();
  await supabase.from('ai_interactions').insert({
    case_id: opts.caseId,
    purpose: 'redactar',
    model: MODEL_PRIMARY,
    prompt: userMsg,
    response: text,
    input_tokens: msg.usage?.input_tokens,
    output_tokens: msg.usage?.output_tokens,
    latency_ms: Date.now() - started
  });

  return text;
}

export { MODEL_PRIMARY, MODEL_FAST };
