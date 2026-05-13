import { NextResponse } from 'next/server';
import { anthropic, SYSTEM_PROMPT_RADICACION, MODEL_FAST } from '@/lib/ai/agent';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

function isMockMode(): boolean {
  if (process.env.AI_MOCK_MODE === 'true') return true;
  return !process.env.ANTHROPIC_API_KEY;
}

function mockReply(messages: { role: string; content: string }[]): string {
  const last = messages[messages.length - 1]?.content ?? '';
  return (
    `[MODO MOCK — sin ANTHROPIC_API_KEY] Recibí su consulta:\n"${last.slice(0, 240)}"\n\n` +
    `Para radicar una PQRS necesito: tipo de documento, número, nombre, número de cuenta contrato, dirección y una descripción detallada del hecho. ` +
    `Le responderemos dentro del término legal de 15 días hábiles aplicable según la causal.`
  );
}

export async function POST(req: Request) {
  const { messages } = await req.json() as { messages: { role: 'user'|'assistant'; content: string }[] };

  const started = Date.now();
  let reply: string;
  let usage: { input_tokens?: number; output_tokens?: number } = {};

  if (isMockMode()) {
    reply = mockReply(messages);
  } else {
    const msg = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 800,
      system: SYSTEM_PROMPT_RADICACION,
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    });
    reply = msg.content[0].type === 'text' ? msg.content[0].text : '';
    usage = { input_tokens: msg.usage?.input_tokens, output_tokens: msg.usage?.output_tokens };
  }

  try {
    const supabase = createSupabaseServiceClient();
    await supabase.from('ai_interactions').insert({
      purpose: 'chat_publico',
      model:   isMockMode() ? 'mock' : MODEL_FAST,
      prompt:  JSON.stringify(messages.slice(-3)),
      response: reply,
      input_tokens:  usage.input_tokens,
      output_tokens: usage.output_tokens,
      latency_ms: Date.now() - started
    });
  } catch { /* logging best-effort */ }

  return NextResponse.json({ reply, mock: isMockMode() });
}
