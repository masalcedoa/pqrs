import { anthropic, MODEL_FAST } from '@/lib/ai/agent';

const SYSTEM = `
Eres un analista de fraude para una empresa de energía en Colombia.
Dado el historial de un cliente y su PQRS actual, evalúa indicadores de fraude:
- consumo declarado inconsistente con histórico
- intentos repetidos de cuestionar mediciones tras visitas técnicas conformes
- sellos rotos / inspección anterior con hallazgos
- coincidencias con otros expedientes flagged

Devuelve JSON estricto:
{ "score": 0..1, "indicadores": [strings], "recomendacion": "ninguna|investigar|visita_urgente|sancion" }
`;

export interface FraudAssessment {
  score: number;
  indicadores: string[];
  recomendacion: 'ninguna' | 'investigar' | 'visita_urgente' | 'sancion';
}

export async function assessFraud(input: { narrative: string; history?: string }): Promise<FraudAssessment> {
  const ctxText = `Narrativa actual:\n${input.narrative}\n\nHistorial:\n${input.history ?? '(sin historial)'}`;
  const msg = await anthropic.messages.create({
    model: MODEL_FAST,
    max_tokens: 300,
    system: SYSTEM,
    messages: [{ role: 'user', content: ctxText }]
  });
  const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
  return JSON.parse(text);
}
