/**
 * Chunker simple por tokens aproximados (~4 chars = 1 token) con solape.
 * Para producción usar tiktoken o el chunker del SDK de embeddings.
 */
export interface Chunk { index: number; content: string; section?: string; tokens: number; }

const APPROX_TOKEN = 4;

export function chunkText(input: string, opts?: {
  maxTokens?: number; overlap?: number; sectionPattern?: RegExp;
}): Chunk[] {
  const maxTokens = opts?.maxTokens ?? 800;
  const overlap   = opts?.overlap   ?? 100;
  const maxChars  = maxTokens * APPROX_TOKEN;
  const overlapCh = overlap * APPROX_TOKEN;
  const sectionPattern = opts?.sectionPattern ?? /^(Art[íi]culo\s+\d+|CAP[IÍ]TULO\s+\w+|T[IÍ]TULO\s+\w+|Secci[oó]n\s+\d+)/m;

  const text = input.replace(/\r\n/g, '\n').trim();
  const chunks: Chunk[] = [];
  let pos = 0, idx = 0;

  while (pos < text.length) {
    const end = Math.min(text.length, pos + maxChars);
    // intenta cortar en final de párrafo más cercano dentro del bloque
    const slice = text.slice(pos, end);
    const lastBreak = slice.lastIndexOf('\n\n');
    const realEnd = lastBreak > maxChars * 0.6 ? pos + lastBreak : end;
    const content = text.slice(pos, realEnd).trim();
    if (content) {
      const sectionMatch = content.match(sectionPattern);
      chunks.push({
        index: idx++,
        content,
        section: sectionMatch?.[0],
        tokens: Math.ceil(content.length / APPROX_TOKEN)
      });
    }
    pos = realEnd - overlapCh;
    if (pos <= 0 || pos >= text.length) break;
  }
  return chunks;
}
