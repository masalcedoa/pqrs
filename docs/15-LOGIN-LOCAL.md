# 15 — Login local (PQRS)

Guía para entrar a la aplicación PQRS corriendo en `http://localhost:3000`.
La pantalla `/login` soporta dos métodos: **contraseña** y **enlace mágico**.
Ambos están construidos sobre Supabase Auth + cookies SSR (`@supabase/ssr`).

## 1. Crear o reiniciar el admin

```bash
npm run seed:admin    # idempotente: crea si no existe
npm run reset:auth    # destructivo: borra y recrea (solo Supabase local)
```

`reset:auth` aborta si `NEXT_PUBLIC_SUPABASE_URL` no apunta a 127.0.0.1/localhost.

Credenciales por defecto:
- email: `admin@pqrs.local`
- password: `PQRS-Admin-2026!`
- org: `demo` — *PQRS Demo S.A. E.S.P.*

Personalizables vía flags: `npm run reset:auth -- --email=otro@x.co --password=Otra123! --slug=mi-empresa`.

## 2. Login con contraseña

1. Abrir http://localhost:3000/login
2. Pestaña **"Contraseña"** (default)
3. Email + password → **Ingresar con contraseña**
4. Redirige automáticamente a `/dashboard`

El cliente browser de `@supabase/ssr` setea la cookie `sb-<host>-auth-token`
(en local: `sb-127-auth-token`). El middleware refresca esa cookie en cada
request y `createSupabaseServerClient()` la lee server-side para
`getUser()` y RLS.

## 3. Login con enlace mágico (Inbucket)

1. Abrir http://localhost:3000/login
2. Pestaña **"Enlace mágico"** → email → **Enviar enlace mágico**
3. Abrir http://localhost:54324 (Inbucket / Mailpit)
4. Click en el correo recibido → click en el botón "Confirm your email"
5. El link manda a `/auth/callback?code=...&next=/dashboard`. El handler
   server intercambia el `code` por una sesión y redirige a `/dashboard`.

Si la página `/login` se llama con `?next=/pqrs`, después del login redirige a `/pqrs`.

## 4. Rutas protegidas

`src/app/(dashboard)/layout.tsx` valida sesión con
`createSupabaseServerClient().auth.getUser()`. Sin sesión, redirige a
`/login`. Las rutas bajo `(dashboard)` quedan protegidas: `/dashboard`,
`/pqrs`, `/pqrs/[id]`, `/ordenes`.

Las rutas públicas no requieren sesión: `/`, `/radicar`, `/login`,
`/api/pqrs` (radicación pública), `/api/ai/chat` (mock o real).

## 5. Verificar el usuario en la BD

```bash
docker exec supabase_db_pqrs-energia psql -U postgres -d postgres -c \
  "select u.email, p.role, m.role as org_role, o.slug
   from auth.users u
   join users_profile p on p.id=u.id
   join org_members m on m.user_id=u.id
   join organizations o on o.id=m.org_id
   where u.email='admin@pqrs.local';"
```

Debe imprimir:
```
admin@pqrs.local | admin | admin | demo
```

Si no aparece la fila → ejecutar `npm run reset:auth`.

## 6. Troubleshooting

### "Invalid login credentials"
- Password incorrecto o usuario no confirmado. Correr `npm run reset:auth`.

### Tras login te quedas en `/login`
- Revisar DevTools → Application → Cookies. Debe existir `sb-127-auth-token`
  (o `sb-<projectRef>-auth-token` con valor que empieza con `base64-…`).
- Si no aparece, probablemente la página fue cargada con `127.0.0.1:3000`
  mientras Supabase config usa `localhost`. Usa siempre **localhost:3000**.
- Limpiar caché del navegador: DevTools → Application → Clear site data.

### `/dashboard` da 307 → `/login` aunque hiciste login
- Cookie expirada. Las sesiones locales duran `jwt_expiry=3600s` (1 h).
- Refresca la página: el middleware refresca el access_token con el
  refresh_token automáticamente si la cookie aún es válida.

### `useSearchParams() should be wrapped in a suspense boundary`
- El componente cliente que usa `useSearchParams()` debe estar dentro de
  `<Suspense>`. Ver `src/app/(auth)/login/page.tsx` como ejemplo.

### Magic link no llega al correo (Inbucket vacío)
- El usuario debe existir en `auth.users`. `signInWithOtp` con
  `enable_signup=true` lo crea on-demand, pero por defecto el config
  local tiene `enable_signup=true` solo para email/password.
- Revisar `supabase/config.toml` → `[auth.email] enable_signup=true`.

### Limpiar la sesión del navegador
- DevTools → Application → Cookies → seleccionar `localhost` → eliminar
  cookies `sb-*`.
- O navegar a `/api/auth/signout` (POST) que llama `supabase.auth.signOut()`
  y limpia las cookies SSR. El sidebar tiene un botón "Salir" que lo hace.

### El callback `/auth/callback` devuelve `/login?error=…`
- El parámetro `code` está expirado o ya fue usado. Volver a pedir el magic link.
- O probar con login por contraseña.

## 7. Validación end-to-end por curl

```bash
# El cliente @supabase/ssr maneja cookies por sí mismo. Para reproducir
# desde Node sin navegador, simular un cookie jar:
cat > /tmp/test.ts << 'EOF'
import { createBrowserClient } from '@supabase/ssr';
const jar = new Map<string,string>();
const sb = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { cookies: { get: n => jar.get(n), set: (n,v) => jar.set(n,v), remove: n => jar.delete(n) } }
);
await sb.auth.signInWithPassword({ email:'admin@pqrs.local', password:'PQRS-Admin-2026!' });
const cookie = Array.from(jar.entries()).map(([n,v])=>`${n}=${v}`).join('; ');
const r = await fetch('http://localhost:3000/dashboard', { headers:{ Cookie: cookie }, redirect:'manual' });
console.log(r.status); // 200 = sesión OK
EOF
npx tsx /tmp/test.ts
```

## 8. Seguridad

- `reset:auth` está restringido a Supabase local (chequea host).
- El password fijo `PQRS-Admin-2026!` es para desarrollo. **En producción,
  rotarlo antes del primer deploy** (`npm run reset:auth -- --password=...`).
- El middleware refresca cookies de sesión y aplica CSP estricta. El
  `connect-src` incluye `http://localhost:54321` y `http://127.0.0.1:54321`
  para Supabase local; en producción agregar el host de Supabase Cloud.

## 9. Despliegue a Vercel + Supabase Cloud

1. Crear proyecto en Supabase Cloud.
2. `npx supabase link --project-ref <ref> && npx supabase db push`.
3. Ejecutar `seed:admin` (no `reset:auth`) apuntado al cloud:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=... \
   npm run seed:admin -- --password=$(openssl rand -base64 32)
   ```
4. En Supabase Dashboard → Authentication → URL Configuration:
   - **Site URL**: `https://<vercel-domain>`
   - **Redirect URLs**: `https://<vercel-domain>/auth/callback`
5. En Vercel, configurar las variables `NEXT_PUBLIC_*`, `SUPABASE_*`,
   `CRON_SECRET`, etc.
6. Deploy y validar: la URL `/auth/callback` debe ser pública (lo es por
   default; no requiere auth previa).
