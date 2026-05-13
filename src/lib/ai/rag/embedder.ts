import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';

export async function embedBatch(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  // Procesa en lotes de 100 (límite del modelo).
  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += 100) {
    const batch = inputs.slice(i, i + 100);
    const r = await openai.embeddings.create({ model: MODEL, input: batch });
    r.data.forEach(d => out.push(d.embedding));
  }
  return out;
}

export async function embedOne(input: string): Promise<number[]> {
  const [v] = await embedBatch([input]);
  return v;
}
