export async function sendWhatsApp(opts: { to: string; body: string }) {
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? process.env.WHATSAPP_PHONE_ID;
  const token   = process.env.META_WHATSAPP_TOKEN ?? process.env.WHATSAPP_TOKEN;
  if (!phoneId || !token) return { ok: false, provider: 'meta', error: 'WhatsApp no configurado' };

  const cleanTo = opts.to.replace(/^whatsapp:/, '').replace(/\D/g, '');
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: cleanTo,
      type: 'text',
      text: { body: opts.body }
    })
  });
  const json = await res.json();
  return res.ok
    ? { ok: true,  provider: 'meta', response: json }
    : { ok: false, provider: 'meta', response: json, error: json?.error?.message };
}
