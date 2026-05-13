#!/usr/bin/env -S node --import tsx/esm
/**
 * Crea (si no existen):
 *  - un usuario admin en auth.users (Supabase Auth)
 *  - su perfil en users_profile con role='admin'
 *  - una organización tenant inicial
 *  - membresía admin en la organización
 *
 * Variables (CLI o .env.local):
 *   ADMIN_EMAIL     correo del admin (default: admin@pqrs.local)
 *   ADMIN_PASSWORD  password (default: PQRS-Admin-2026!)
 *   ORG_SLUG        slug de la org (default: demo)
 *   ORG_NAME        nombre de la org (default: PQRS Demo S.A. E.S.P.)
 *
 * Uso:
 *   npm run seed:admin
 *   npm run seed:admin -- --email=admin@empresa.co --slug=empresa-a --name="Empresa A"
 */
import { config as dotenv } from 'dotenv';
import { existsSync } from 'node:fs';
if (existsSync('.env.local')) dotenv({ path: '.env.local' });
else if (existsSync('.env')) dotenv();
import { createClient } from '@supabase/supabase-js';

const args = parseArgs(process.argv.slice(2));
const ADMIN_EMAIL    = args.email     ?? process.env.ADMIN_EMAIL    ?? 'admin@pqrs.local';
const ADMIN_PASSWORD = args.password  ?? process.env.ADMIN_PASSWORD ?? 'PQRS-Admin-2026!';
const ORG_SLUG       = args.slug      ?? process.env.ORG_SLUG       ?? 'demo';
const ORG_NAME       = args.name      ?? process.env.ORG_NAME       ?? 'PQRS Demo S.A. E.S.P.';

const url     = req('NEXT_PUBLIC_SUPABASE_URL');
const service = req('SUPABASE_SERVICE_ROLE_KEY');

const sb = createClient(url, service, { auth: { persistSession: false } });

async function main() {
  console.log('— seed-admin —');
  console.log(`Supabase URL: ${url}`);
  console.log(`Admin email:  ${ADMIN_EMAIL}`);
  console.log(`Org slug:     ${ORG_SLUG}`);

  // 1. Auth user
  let userId: string;
  const { data: existing } = await sb.auth.admin.listUsers();
  const found = existing?.users?.find(u => u.email === ADMIN_EMAIL);
  if (found) {
    userId = found.id;
    console.log(`✔ Usuario ya existe: ${userId}`);
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Administrador' }
    });
    if (error || !data.user) throw new Error(`No se pudo crear usuario: ${error?.message ?? JSON.stringify(error)} | data=${JSON.stringify(data)}`);
    userId = data.user.id;
    console.log(`✔ Usuario creado: ${userId}`);
  }

  // 2. users_profile (admin)
  const { error: pErr } = await sb.from('users_profile').upsert({
    id: userId, full_name: 'Administrador', role: 'admin', is_active: true
  });
  if (pErr) throw new Error(`No se pudo crear perfil: ${pErr.message}`);
  console.log('✔ users_profile (admin)');

  // 3. organization
  const { data: orgExisting } = await sb.from('organizations').select('id').eq('slug', ORG_SLUG).maybeSingle();
  let orgId: string;
  if (orgExisting) {
    orgId = orgExisting.id;
    console.log(`✔ Organización ya existe: ${orgId}`);
  } else {
    const { data: org, error: oErr } = await sb.from('organizations').insert({
      slug: ORG_SLUG, name: ORG_NAME, plan_code: 'starter',
      branding: { primary_color: '#1f6feb', primary_color_dark: '#13469a' },
      created_by: userId
    }).select('id').single();
    if (oErr || !org) throw new Error(`No se pudo crear org: ${oErr?.message}`);
    orgId = org.id;
    console.log(`✔ Organización creada: ${orgId}`);
  }

  // 4. membership
  const { error: mErr } = await sb.from('org_members').upsert({
    org_id: orgId, user_id: userId, role: 'admin', is_default: true
  });
  if (mErr) throw new Error(`No se pudo crear membresía: ${mErr.message}`);
  console.log('✔ membresía admin');

  // 5. backfill org_id en filas previas que estén con null (idempotente)
  const tables = ['legal_terms','response_templates','organizational_units','holidays_co'].filter(Boolean);
  for (const t of tables) {
    try { await sb.from(t).update({ org_id: orgId }).is('org_id', null); } catch { /* ok si no tiene org_id */ }
  }

  console.log('\nResumen:');
  console.log(`  user_id: ${userId}`);
  console.log(`  org_id : ${orgId}`);
  console.log(`  slug   : ${ORG_SLUG}`);
  console.log(`\nUsar para login:\n  email:    ${ADMIN_EMAIL}\n  password: ${ADMIN_PASSWORD}`);
}

function req(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`Falta ${name}. Configura .env.local`); process.exit(1); }
  return v;
}

function parseArgs(arr: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of arr) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

main().catch(err => { console.error('✖', err.message); process.exit(1); });
