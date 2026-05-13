export async function sendEmail(opts: { to: string; subject: string; body: string; from?: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, provider: 'resend', error: 'RESEND_API_KEY no configurada' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: opts.from ?? process.env.RESEND_FROM ?? 'PQRS <noreply@pqrs.local>',
      to: [opts.to],
      subject: opts.subject,
      html: opts.body.replace(/\n/g, '<br/>')
    })
  });
  const json = await res.json();
  return res.ok
    ? { ok: true,  provider: 'resend', response: json }
    : { ok: false, provider: 'resend', response: json, error: json?.message };
}
