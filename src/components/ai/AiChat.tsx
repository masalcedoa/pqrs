'use client';

import { useState } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function AiChat() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        'Hola, soy su asistente de PQRS. Cuénteme su situación y le ayudo a radicarla correctamente. ' +
        '¿De qué se trata su solicitud?'
    }
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input.trim() || loading) return;
    const next: Msg[] = [...messages, { role: 'user', content: input.trim() }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next })
      });
      const json = await res.json();
      setMessages([...next, { role: 'assistant', content: json.reply ?? '(sin respuesta)' }]);
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Lo siento, ocurrió un error. Intente más tarde.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[640px] flex-col rounded-xl border bg-white shadow-sm">
      <header className="border-b px-4 py-3">
        <h3 className="font-semibold">Asistente IA — Radicación</h3>
        <p className="text-xs text-gray-500">Le ayuda a clasificar y completar su PQRS.</p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <span
              className={
                'inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm ' +
                (m.role === 'user'
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-900')
              }
            >
              {m.content}
            </span>
          </div>
        ))}
        {loading && <p className="text-xs text-gray-500">Pensando…</p>}
      </div>

      <div className="border-t p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder="Escriba su consulta…"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <button
            onClick={send} disabled={loading}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
