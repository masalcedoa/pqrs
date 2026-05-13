import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const SECURITY_HEADERS: Record<string, string> = {
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' data: https://*.supabase.co",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' http://127.0.0.1:54321 http://localhost:54321 https://*.supabase.co https://api.anthropic.com https://api.openai.com",
    "font-src 'self' data:",
    "frame-ancestors 'none'"
  ].join('; ')
};

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string)  { return req.cookies.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({ name, value, ...options });
          res = NextResponse.next({ request: req });
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({ name, value: '', ...options });
          res = NextResponse.next({ request: req });
          res.cookies.set({ name, value: '', ...options });
        }
      }
    }
  );
  // Refresca la sesión SSR (cookies) para que getUser() server-side esté siempre fresco.
  await supabase.auth.getUser();

  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);

  // Propagar tenant resuelto por host como header interno.
  const host = req.headers.get('host') ?? '';
  const sub = host.split('.')[0];
  if (sub && sub !== 'app' && sub !== 'www' && host.split('.').length >= 3) {
    res.headers.set('x-tenant-slug', sub);
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg)).*)']
};
