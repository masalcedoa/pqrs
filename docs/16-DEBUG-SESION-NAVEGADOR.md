# 16 — Debug de sesión en el navegador (Chrome / Edge)

Esta guía resuelve el síntoma "**hago login pero sigo en /login**" cuando
todo el backend ya pasó las pruebas E2E.

## Causa típica

Después de varios reload con builds diferentes, el navegador puede tener:

1. **Bundle JS antiguo en caché** del `/login` (el botón usa el flujo viejo).
2. **Cookies sb-*** stale de una sesión anterior con otro JWT secret /
   proyecto, que `auth.getUser()` rechaza.
3. **Mezcla de orígenes** `127.0.0.1:3000` ↔ `localhost:3000`: las cookies
   se setean en uno pero el SSR las pide en el otro.
4. **Service Worker** registrado de otro proyecto en `localhost`.

## 1. Limpieza completa de Chrome para `localhost`

DevTools → **Application** → **Storage**:

1. Click en `http://localhost:3000` (sidebar izquierdo).
2. Botón **Clear site data** (caja "Clear storage").
   - Marca todas las casillas: Cookies, LocalStorage, SessionStorage,
     IndexedDB, Cache Storage, **Unregister service workers**.
3. Repetir lo mismo para `http://127.0.0.1:3000` si lo tienes en el listado.

Atajo equivalente: pegar en la barra `chrome://settings/content/all?searchSubpage=localhost` → eliminar.

Hard reload: `Ctrl+Shift+R` (Windows) o `Ctrl+F5`.

## 2. Verificar el bundle servido

```powershell
curl -s http://localhost:3000/login | findstr "Modo desarrollo"
```

Debe imprimir la línea con "Modo desarrollo". Si no aparece, el dev server
quedó con caché stale → `pqrs-stop`, borrar `.next`, `pqrs-start`.

## 3. Ruta `/debug/session`

Solo disponible en `NODE_ENV=development`. Muestra lo que el servidor ve
de tu sesión:

- `NEXT_PUBLIC_SUPABASE_URL` activo
- `host` header (`localhost:3000` vs `127.0.0.1:3000`)
- todas las cookies que llegan al servidor
- presencia de cookies `sb-*`
- `auth.getUser()` y su error si existe
- `users_profile.role`
- `org_members.role`
- `fn_current_role()` y `current_org_id()` ejecutadas via RPC
- `resolveTenant()` server-side

Acceso:

- Directo: http://localhost:3000/debug/session
- Botón **Diagnosticar sesion** en `/login` (modo dev, banner amarillo).

### Interpretación rápida

| Síntoma                                            | Significa                                |
|----------------------------------------------------|------------------------------------------|
| `sb-* cookies presentes = (ninguna)`               | El login falló o las cookies fueron borradas. Vuelve a `/login`. |
| `sb-* cookies presentes = sb-127-auth-token` pero `user.email = (no user)` | Cookie corrupta o de otro proyecto. Borrar storage del sitio. |
| `user.email = admin@pqrs.local` y `resolveTenant().slug = demo` | Sesión OK. Si aún así `/dashboard` redirige, hay caché de Service Worker o bundle viejo: hard reload. |
| `host header = 127.0.0.1:3000`                     | Estás en el origen equivocado. Abre `http://localhost:3000`. |

## 4. Origen consistente

La app y Supabase deben hablarse desde el mismo "tipo" de hostname para
que las cookies de la sesión sean visibles tanto en el JS del cliente
como en el SSR.

Configuración estándar (ya aplicada):

- App: `http://localhost:3000`
- Supabase API (desde el browser): `http://127.0.0.1:54321`
  (la cookie de sesión la setea JS sobre el origen de la página = `localhost`)
- `.env.local`:
  - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
  - `APP_URL=http://localhost:3000`
  - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`

**Regla de oro:** siempre abre la app con `http://localhost:3000`. Si
escribes `127.0.0.1:3000`, las cookies de sesión quedan en otro origen y
el SSR no las ve.

## 5. Pasos completos de reset local

```powershell
# 1. Apagar Next.js
powershell -ExecutionPolicy Bypass -File C:\Users\msalcedo\Documents\sss\projects\05-PQRS\scripts\stop-pqrs.ps1

# 2. Borrar .next (cache del dev server)
Remove-Item -Recurse -Force C:\Users\msalcedo\Documents\sss\projects\05-PQRS\.next

# 3. (Opcional) Reset duro de Supabase local — borra datos.
#    No suele ser necesario.
# cd C:\Users\msalcedo\Documents\sss\projects\05-PQRS; npx supabase db reset

# 4. Re-sembrar admin (idempotente; usa reset:auth si la cuenta quedó rota)
cd C:\Users\msalcedo\Documents\sss\projects\05-PQRS
npm run reset:auth

# 5. Volver a arrancar
powershell -ExecutionPolicy Bypass -File C:\Users\msalcedo\Documents\sss\projects\05-PQRS\scripts\start-pqrs.ps1
```

En Chrome:

1. Cerrar todas las pestañas de `localhost:3000`.
2. DevTools → Application → Clear site data (Unregister service workers
   incluido).
3. Reabrir `http://localhost:3000/login`.
4. Click en **Entrar como administrador demo** (banner amarillo).
5. Te debe llevar a `/dashboard`.

## 6. Si aún falla — checklist final

- [ ] Confirma que el dev server respondió **200** al GET `/login` reciente
      (terminal del dev).
- [ ] `curl -s http://localhost:3000/login | findstr "Modo desarrollo"` muestra la línea.
- [ ] En Chrome DevTools → Network, después del click ves un POST a
      `127.0.0.1:54321/auth/v1/token?grant_type=password` con status **200**.
- [ ] DevTools → Application → Cookies → `localhost` contiene
      `sb-127-auth-token` con valor que empieza por `base64-eyJ…`.
- [ ] `/debug/session` muestra `user.email = admin@pqrs.local`.

Si esos 5 puntos pasan y `/dashboard` aún redirige a `/login`, es un bug
del middleware o del layout: capturar los logs del dev server al hacer
`GET /dashboard` y compartir.

## 7. Ventana incógnito como herramienta

Si en modo normal nada funciona, abre una **ventana incógnito** o un
navegador secundario (Edge / Brave). Si en incógnito sí entra, el
problema es 100% caché/cookies stale en tu perfil normal — repetir paso 1.

## 8. Producción

`/debug/session` está protegida con `if (process.env.NODE_ENV !== 'development') notFound()` y se elimina del bundle de producción. **No exponer en Vercel.**

Si quieres conservar esta ruta para staging, protégela con un gate
adicional por header (por ejemplo `x-debug-token` comparado con una
variable secreta) o muévela detrás de un middleware de admin-only.
