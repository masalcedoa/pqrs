#!/usr/bin/env -S node --import tsx/esm
/**
 * Smoke test end-to-end contra la app levantada (asume `npm run dev` corriendo).
 * Cubre:
 *   - GET  /                              200
 *   - GET  /radicar                       200
 *   - POST /api/pqrs                      crea PQRS y devuelve radicado
 *   - POST /api/ai/chat                   responde (mock o real)
 *   - GET  /api/powerbi/por_tipo          requiere token (espera 401 sin token)
 *
 * Uso: `npm run smoke`  (BASE_URL configurable; default http://localhost:3000)
 */
import { config as dotenv } from 'dotenv';
import { existsSync } from 'node:fs';
if (existsSync('.env.local')) dotenv({ path: '.env.local' });
else if (existsSync('.env')) dotenv();

const BASE = process.env.SMOKE_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

interface Check { name: string; run: () => Promise<void>; }

const results: Array<{ name: string; ok: boolean; detail?: string }> = [];

const checks: Check[] = [
  {
    name: 'GET /  → 200',
    run: async () => {
      const r = await fetch(`${BASE}/`);
      assert(r.ok, `status=${r.status}`);
    }
  },
  {
    name: 'GET /radicar → 200',
    run: async () => {
      const r = await fetch(`${BASE}/radicar`);
      assert(r.ok, `status=${r.status}`);
    }
  },
  {
    name: 'POST /api/pqrs (radicación pública)',
    run: async () => {
      const payload = {
        customer: {
          kind: 'persona_natural',
          document_type: 'CC',
          document_id: '1' + Date.now().toString().slice(-9),
          full_name: 'Smoke Tester',
          email: 'smoke@pqrs.local'
        },
        type: 'reclamo',
        narrative: 'Smoke test: factura del mes pasado vino más alta de lo habitual y no se ha aplicado el ajuste solicitado.'
      };
      const r = await fetch(`${BASE}/api/pqrs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await r.json();
      assert(r.ok, `status=${r.status} body=${JSON.stringify(json).slice(0,200)}`);
      assert(typeof json.radicado === 'string' && json.radicado.startsWith('PQRS-'),
        `radicado inválido: ${JSON.stringify(json)}`);
    }
  },
  {
    name: 'POST /api/ai/chat (mock o real)',
    run: async () => {
      const r = await fetch(`${BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Mi factura vino muy alta' }] })
      });
      const j = await r.json();
      assert(r.ok, `status=${r.status}`);
      assert(typeof j.reply === 'string' && j.reply.length > 5, 'reply vacío');
    }
  },
  {
    name: 'GET /api/powerbi/por_tipo sin token → 401',
    run: async () => {
      const r = await fetch(`${BASE}/api/powerbi/por_tipo`);
      assert(r.status === 401, `esperado 401, recibido ${r.status}`);
    }
  }
];

async function main() {
  console.log(`— smoke-test — base: ${BASE}\n`);
  for (const c of checks) {
    process.stdout.write(`• ${c.name} ... `);
    try { await c.run(); results.push({ name: c.name, ok: true });  console.log('OK'); }
    catch (e) {           results.push({ name: c.name, ok: false, detail: (e as Error).message }); console.log('FAIL'); }
  }

  const fail = results.filter(r => !r.ok);
  console.log(`\nResumen: ${results.length - fail.length}/${results.length} OK`);
  for (const f of fail) console.log(`  ✖ ${f.name}: ${f.detail}`);
  process.exit(fail.length ? 1 : 0);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

main();
