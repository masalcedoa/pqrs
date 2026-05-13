#!/usr/bin/env -S node --import tsx/esm
/**
 * Resetea el usuario admin local: lo elimina si existe, lo recrea con email
 * confirmado, crea (o reutiliza) la organización demo y la membresía admin.
 *
 * Uso:
 *   npm run reset:auth
 *   npm run reset:auth -- --email=admin@empresa.co --password=otra
 *
 * NUNCA correr contra Supabase Cloud. Aborta si NEXT_PUBLIC_SUPABASE_URL no
 * apunta a 127.0.0.1 / localhost.
 */
import { config as dotenv } from 'dotenv';
import { existsSync } from 'node:fs';
if (existsSync('.env.local')) dotenv({ path: '.env.local' });
else if (existsSync('.env')) dotenv();
import { createClient } from '@supabase/supabase-js';

const args = parseArgs(process.argv.slice(2));
const ADMIN_EMAIL    = args.email    ?? process.env.ADMIN_EMAIL    ?? 'admin@pqrs.local';
const ADMIN_PASSWORD = args.password ?? process.env.ADMIN_PASSWORD ?? 'PQRS-Admin-2026!';
const ORG_SLUG       = args.slug     ?? process.env.ORG_SLUG       ?? 'demo';
const ORG_NAME       = args.name     ?? process.env.ORG_NAME       ?? 'PQRS Demo S.A. E.S.P.';

const url     = req('NEXT_PUBLIC_SUPABASE_URL');
const service = req('SUPABASE_SERVICE_ROLE_KEY');

if (!/^(http:\/\/)?(127\.0\.0\.1|localhost)/.test(url)) {
  console.error(`✖ Refuso ejecutar contra ${url}. Este script es solo para Supabase local.`);
  process.exit(2);
}

const sb = createClient(url, service, { auth: { persistSession: false } });

async function main() {
  console.log('— reset-local-auth —');
  console.log(`Supabase URL: ${url}`);
  console.log(`Admin email:  ${ADMIN_EMAIL}`);
  console.log(`Org slug:     ${ORG_SLUG}`);

  // 1) Si existe, intentar borrar; si falla por FK, actualizamos el password en su lugar.
  const { data: listed } = await sb.auth.admin.listUsers();
  const existing = listed?.users?.find(u => u.email === ADMIN_EMAIL);
  let userId: string;

  if (existing) {
    const { error: delErr } = await sb.auth.admin.deleteUser(existing.id);
    if (delErr) {
      console.log(`! No se pudo borrar (probable FK): ${delErr.message}. Actualizo password en su lugar.`);
      const { error: upErr } = await sb.auth.admin.updateUserById(existing.id, {
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: 'Administrador' }
      });
      if (upErr) throw new Error(`No se pudo actualizar usuario: ${upErr.message}`);
      console.log(`✔ Password reseteado para ${ADMIN_EMAIL}`);
      userId = existing.id;
    } else {
      console.log(`✔ Usuario previo eliminado: ${existing.id}`);
      const { data, error } = await sb.auth.admin.createUser({
        email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: 'Administrador' }
      });
      if (error || !data.user) throw new Error(`No se pudo crear usuario: ${error?.message}`);
      userId = data.user.id;
      console.log(`✔ Usuario creado: ${userId}`);
    }
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Administrador' }
    });
    if (error || !data.user) throw new Error(`No se pudo crear usuario: ${error?.message}`);
    userId = data.user.id;
    console.log(`✔ Usuario creado: ${userId}`);
  }

  // 3) Perfil con rol admin.
  const { error: pErr } = await sb.from('users_profile').upsert({
    id: userId, full_name: 'Administrador', role: 'admin', is_active: true
  });
  if (pErr) throw new Error(`No se pudo crear perfil: ${pErr.message}`);
  console.log('✔ users_profile (admin)');

  // 4) Organización (idempotente).
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

  // 5) Membresía admin.
  const { error: mErr } = await sb.from('org_members').upsert({
    org_id: orgId, user_id: userId, role: 'admin', is_default: true
  });
  if (mErr) throw new Error(`No se pudo crear membresía: ${mErr.message}`);
  console.log('✔ membresía admin');

  console.log('\nResumen:');
  console.log(`  user_id: ${userId}`);
  console.log(`  org_id : ${orgId}`);
  console.log(`  slug   : ${ORG_SLUG}`);
  console.log(`\nLogin:\n  email:    ${ADMIN_EMAIL}\n  password: ${ADMIN_PASSWORD}`);
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
