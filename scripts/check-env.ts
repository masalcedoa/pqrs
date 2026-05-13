#!/usr/bin/env -S node --import tsx/esm
/**
 * Verifica que el .env.local tenga lo mínimo para arrancar y reporta lo opcional.
 * Uso: `npm run check:env`
 */
import { config as dotenv } from 'dotenv';
import { existsSync } from 'node:fs';
if (existsSync('.env.local')) dotenv({ path: '.env.local' });
else if (existsSync('.env')) dotenv();

interface VarSpec {
  name: string;
  required: boolean;
  group: 'supabase' | 'app' | 'ai' | 'notif' | 'powerbi' | 'cron';
  hint?: string;
}

const VARS: VarSpec[] = [
  { name: 'NEXT_PUBLIC_SUPABASE_URL',         required: true,  group: 'supabase' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',    required: true,  group: 'supabase' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY',        required: true,  group: 'supabase' },
  { name: 'SUPABASE_DB_URL',                  required: false, group: 'supabase', hint: 'requerido para scripts/seed-admin.ts y supabase db push' },
  { name: 'APP_URL',                          required: false, group: 'app',      hint: 'fallback: NEXT_PUBLIC_APP_URL' },
  { name: 'NEXT_PUBLIC_APP_URL',              required: true,  group: 'app' },
  { name: 'CRON_SECRET',                      required: true,  group: 'cron' },
  { name: 'ANTHROPIC_API_KEY',                required: false, group: 'ai',       hint: 'sin esto, AI_MOCK_MODE=true devuelve mocks' },
  { name: 'OPENAI_API_KEY',                   required: false, group: 'ai',       hint: 'requerido para RAG real' },
  { name: 'RESEND_API_KEY',                   required: false, group: 'notif' },
  { name: 'META_WHATSAPP_TOKEN',              required: false, group: 'notif' },
  { name: 'META_WHATSAPP_PHONE_NUMBER_ID',    required: false, group: 'notif' },
  { name: 'POWERBI_API_SECRET',               required: false, group: 'powerbi',  hint: 'usado como hash base para tokens del endpoint /api/powerbi' }
];

const present = (v: string) => Boolean(process.env[v] && process.env[v]!.trim() !== '');

const missing = VARS.filter(v => v.required && !present(v.name));
const ok      = VARS.filter(v =>  v.required &&  present(v.name));
const optMiss = VARS.filter(v => !v.required && !present(v.name));
const optOk   = VARS.filter(v => !v.required &&  present(v.name));

console.log('— check-env —');
console.log('\nObligatorias presentes:');
ok.forEach(v => console.log(`  ✔ ${v.name}`));

if (missing.length) {
  console.log('\nObligatorias FALTANTES:');
  missing.forEach(v => console.log(`  ✖ ${v.name}${v.hint ? '  — ' + v.hint : ''}`));
}

console.log('\nOpcionales presentes:');
optOk.forEach(v => console.log(`  ✔ ${v.name}`));

console.log('\nOpcionales FALTANTES (no bloquean):');
optMiss.forEach(v => console.log(`  · ${v.name}${v.hint ? '  — ' + v.hint : ''}`));

console.log(`\nAI_MOCK_MODE actual: ${process.env.AI_MOCK_MODE ?? 'unset (auto-mock si no hay ANTHROPIC_API_KEY)'}`);

if (missing.length) {
  console.error(`\n✖ Faltan ${missing.length} variables obligatorias. Edita .env.local.`);
  process.exit(1);
} else {
  console.log('\n✔ Listo para arrancar `npm run dev`');
}
