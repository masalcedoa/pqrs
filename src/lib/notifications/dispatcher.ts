import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { sendEmail }    from './providers/email-resend';
import { sendWhatsApp } from './providers/whatsapp-meta';
import { sendSMS }      from './providers/sms';

const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 30_000;

interface QueueRow {
  id: string;
  org_id: string | null;
  channel: 'email' | 'whatsapp' | 'sms' | 'push';
  recipient: string;
  subject: string | null;
  body: string;
  template: string | null;
  payload: Record<string, unknown> | null;
  attempts: number;
}

/** Toma N pendientes con lock corto, las envía, registra attempt y actualiza estado. */
export async function dispatchPending(limit = 25): Promise<{ processed: number; success: number; failed: number }> {
  const sb = createSupabaseServiceClient();
  const lockUntil = new Date(Date.now() + 60_000).toISOString();

  const { data: locked } = await sb.from('notifications')
    .update({ locked_until: lockUntil })
    .lte('scheduled_at', new Date().toISOString())
    .eq('status', 'pendiente')
    .or(`locked_until.is.null,locked_until.lt.${new Date().toISOString()}`)
    .lt('attempts', MAX_ATTEMPTS)
    .select()
    .limit(limit);

  let success = 0;
  let failed  = 0;

  for (const n of (locked ?? []) as QueueRow[]) {
    const started = Date.now();
    let result: { ok: boolean; provider: string; response?: unknown; error?: string };
    try {
      if (n.channel === 'email')         result = await sendEmail({ to: n.recipient, subject: n.subject ?? '', body: n.body });
      else if (n.channel === 'whatsapp') result = await sendWhatsApp({ to: n.recipient, body: n.body });
      else if (n.channel === 'sms')      result = await sendSMS({ to: n.recipient, body: n.body });
      else                                result = { ok: false, provider: 'unknown', error: 'canal no soportado' };
    } catch (err) {
      result = { ok: false, provider: 'exception', error: (err as Error).message };
    }

    await sb.from('notification_attempts').insert({
      notification_id: n.id,
      status: result.ok ? 'enviado' : 'fallido',
      provider: result.provider,
      provider_response: (result.response ?? { error: result.error }) as object,
      latency_ms: Date.now() - started
    });

    if (result.ok) {
      success++;
      await sb.from('notifications').update({
        status: 'enviado', sent_at: new Date().toISOString(),
        provider: result.provider, locked_until: null
      }).eq('id', n.id);
    } else {
      failed++;
      const attempts = n.attempts + 1;
      const reachedMax = attempts >= MAX_ATTEMPTS;
      const nextSchedule = new Date(Date.now() + BACKOFF_BASE_MS * 2 ** attempts).toISOString();
      await sb.from('notifications').update({
        attempts,
        status: reachedMax ? 'fallido' : 'pendiente',
        last_error: result.error ?? null,
        scheduled_at: nextSchedule,
        locked_until: null
      }).eq('id', n.id);
    }
  }

  return { processed: (locked ?? []).length, success, failed };
}
