'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Mode = 'password' | 'magic';
type Status = 'idle' | 'busy' | 'ok' | 'error';

const IS_DEV = process.env.NODE_ENV === 'development';
const DEV_EMAIL = 'admin@pqrs.local';
const DEV_PASSWORD = 'PQRS-Admin-2026!';

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-6 py-16"><p>Cargando…</p></main>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const sp = useSearchParams();
  const nextPath = sp.get('next') || '/dashboard';

  const [mode, setMode]         = useState<Mode>('password');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus]     = useState<Status>('idle');
  const [message, setMessage]   = useState<string>('');

  function go(path: string) {
    // Navegación hard: garantiza que la siguiente request incluye la cookie
    // recién seteada por @supabase/ssr y que el layout SSR rehidrata
    // el componente con la sesión nueva. router.push es soft y puede
    // chocar con la caché del router en App Router.
    window.location.assign(path);
  }

  async function doPasswordLogin(emailOverride?: string, passwordOverride?: string) {
    const em = emailOverride ?? email;
    const pw = passwordOverride ?? password;
    if (!em || !pw) { setStatus('error'); setMessage('Email y contraseña son obligatorios.'); return; }
    setStatus('busy'); setMessage('Ingresando…');
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
      if (error) { setStatus('error'); setMessage(error.message); return; }
      setStatus('ok'); setMessage('Login exitoso, redirigiendo…');
      go(nextPath);
    } catch (e) {
      setStatus('error');
      setMessage((e as Error)?.message ?? 'Error inesperado durante el login.');
    }
  }

  async function doMagicLink() {
    if (!email) { setStatus('error'); setMessage('Ingresa un email.'); return; }
    setStatus('busy'); setMessage('Enviando enlace…');
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
      if (error) { setStatus('error'); setMessage(error.message); return; }
      setStatus('ok');
      setMessage(IS_DEV
        ? `Enlace enviado. Ábrelo en Inbucket: http://localhost:54324`
        : `Le enviamos un enlace a ${email}.`);
    } catch (e) {
      setStatus('error');
      setMessage((e as Error)?.message ?? 'Error inesperado.');
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (mode === 'password') doPasswordLogin();
    else doMagicLink();
  }

  const busy = status === 'busy';

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold">Acceso de funcionarios</h1>

      <div className="mt-4 flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => { setMode('password'); setStatus('idle'); setMessage(''); }}
          className={`px-3 py-2 text-sm ${mode === 'password' ? 'border-b-2 border-brand-600 font-semibold text-brand-700' : 'text-gray-500'}`}
        >Contraseña</button>
        <button
          type="button"
          onClick={() => { setMode('magic'); setStatus('idle'); setMessage(''); }}
          className={`px-3 py-2 text-sm ${mode === 'magic' ? 'border-b-2 border-brand-600 font-semibold text-brand-700' : 'text-gray-500'}`}
        >Enlace mágico</button>
      </div>

      <form noValidate onSubmit={onSubmit} className="mt-4 space-y-3">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email" autoComplete="email"
          placeholder="correo@empresa.co"
          className="w-full rounded-md border border-gray-300 px-3 py-2"
        />

        {mode === 'password' && (
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password" autoComplete="current-password"
            placeholder="Contraseña"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
        )}

        {message && (
          <p className={
            status === 'error'  ? 'text-sm text-red-600' :
            status === 'ok'     ? 'text-sm text-emerald-700' :
            'text-sm text-gray-600'
          }>{message}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-brand-600 px-4 py-2 text-white disabled:opacity-60"
        >
          {busy
            ? (mode === 'password' ? 'Ingresando…' : 'Enviando…')
            : (mode === 'password' ? 'Ingresar con contraseña' : 'Enviar enlace mágico')}
        </button>
      </form>

      {IS_DEV && (
        <div className="mt-6 rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-semibold text-amber-800">Modo desarrollo</p>
          <p className="mt-1 text-amber-700">
            Credenciales demo: <code>{DEV_EMAIL}</code> / <code>{DEV_PASSWORD}</code>
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => doPasswordLogin(DEV_EMAIL, DEV_PASSWORD)}
            className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            Entrar como administrador demo
          </button>
          <a
            href="/debug/session"
            className="ml-2 inline-block rounded-md border border-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-800"
          >
            Diagnosticar sesion
          </a>
        </div>
      )}
    </main>
  );
}
