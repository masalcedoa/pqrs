import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { embedOne } from './embedder';

export interface RagHit {
  id: number;
  document_id: string;
  content: string;
  section: string | null;
  score: number;
}

/**
 * Recuperación híbrida (semántica + léxica) vía RPC fn_rag_hybrid_search.
 * Bitácora de cada consulta en rag_query_log para mejora continua.
 */
export async function retrieve(opts: {
  orgId: string | null;
  query: string;
  corpusId?: string | null;
  topK?: number;
  userId?: string | null;
  caseId?: string | null;
}): Promise<RagHit[]> {
  const started = Date.now();
  const sb = createSupabaseServiceClient();
  const embedding = await embedOne(opts.query);

  const { data, error } = await sb.rpc('fn_rag_hybrid_search', {
    p_org: opts.orgId,
    p_query: opts.query,
    p_query_embedding: embedding as unknown as string, // pgvector recibe el array como string en postgrest
    p_corpus: opts.corpusId ?? null,
    p_top_k: opts.topK ?? 8
  });

  if (error) {
    console.error('rag retrieve error', error);
    return [];
  }

  const hits = (data ?? []) as RagHit[];

  // Bitácora
  try {
    await sb.from('rag_query_log').insert({
      org_id: opts.orgId, user_id: opts.userId ?? null, case_id: opts.caseId ?? null,
      query_text: opts.query,
      retrieved_ids: hits.map(h => h.id),
      scores: hits.map(h => h.score),
      model: process.env.OPENAI_EMBEDDING_MODEL,
      latency_ms: Date.now() - started
    });
  } catch { /* best-effort */ }

  return hits;
}

/** Formatea hits para inyectar en el prompt de un modelo. */
export function formatContext(hits: RagHit[]): string {
  return hits.map((h, i) =>
    `[${i + 1}] (${h.section ?? 'sección no marcada'}, score=${h.score.toFixed(3)})\n${h.content}`
  ).join('\n\n---\n\n');
}
