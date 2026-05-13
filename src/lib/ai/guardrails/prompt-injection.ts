/**
 * Detección de prompt-injection en input de usuario.
 * Lista parcial — complementar con clasificador ML en producción.
 * Las coincidencias graves bloquean el envío al modelo y registran señal de abuso.
 */
const PATTERNS: Array<{ name: string; rx: RegExp; severity: 'low' | 'medium' | 'high' }> = [
  { name: 'ignore_previous',    rx: /\b(ignor[ae]|olvid[ae])\s+(las|tus|el)\s+(instrucciones|sistema|prompt)/i, severity: 'high' },
  { name: 'reveal_system',      rx: /\b(repite|mu[eé]strame|cu[aá]l\s+es)\s+(tu|el)\s+(prompt|system|instruccion)/i, severity: 'high' },
  { name: 'change_role',        rx: /\b(act[uú]a|comp[oó]rtate)\s+como\s+(otro|un\s+hacker|admin|root)/i, severity: 'medium' },
  { name: 'override_persona',   rx: /\bdesde\s+ahora\s+(eres|ser[aá]s)\s+/i, severity: 'medium' },
  { name: 'leak_secrets',       rx: /\b(mu[eé]stra(?:me)?|revela(?:me)?|dime|d[eé]jame\s+ver|imprime|imprime\s+el)\b.{0,40}\b(api[\s_-]?key|service[\s_-]?role|secreto|password|contrase[ñn]a|env(?:ironment)?\s+vars?)\b|\b(api[\s_-]?key|service[\s_-]?role|secreto|password|contrase[ñn]a)\b.{0,40}\b(mu[eé]stra|revela|dime|imprime)\b/i, severity: 'high' },
  { name: 'sql_injection',      rx: /(union\s+select|drop\s+table|;--|\bor\s+1=1\b)/i, severity: 'high' },
  { name: 'jailbreak_DAN',      rx: /\b(DAN|jailbreak|do\s+anything\s+now)\b/i, severity: 'medium' },
  { name: 'tool_invocation',    rx: /\b(call|llama|invoca)\s+(la\s+)?tool\s+\w+\s*\(/i, severity: 'medium' }
];

export interface PromptScanResult {
  blocked: boolean;
  hits: Array<{ name: string; severity: string }>;
}

export function scanPromptInjection(input: string): PromptScanResult {
  const hits: PromptScanResult['hits'] = [];
  for (const p of PATTERNS) {
    if (p.rx.test(input)) hits.push({ name: p.name, severity: p.severity });
  }
  const blocked = hits.some(h => h.severity === 'high');
  return { blocked, hits };
}
