'use client';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface Comment {
  id: string;
  body: string;
  author_id: string | null;
  is_internal: boolean;
  created_at: string;
}

export default function CaseComments({ caseId, initial }: { caseId: string; initial: Comment[] }) {
  const [list, setList]   = useState<Comment[]>(initial);
  const [body, setBody]   = useState('');
  const [internal, setInternal] = useState(true);
  const [busy, setBusy]   = useState(false);

  async function add() {
    if (!body.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/pqrs/${caseId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, is_internal: internal })
    });
    if (res.ok) {
      const j = await res.json();
      setList([...list, j.comment]);
      setBody('');
    }
    setBusy(false);
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <ul className="space-y-3">
          {list.length === 0 && <li className="text-sm text-gray-500">Sin comentarios.</li>}
          {list.map(c => (
            <li key={c.id} className="rounded border p-3">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <Badge tone={c.is_internal ? 'warning' : 'info'}>
                  {c.is_internal ? 'interno' : 'visible al ciudadano'}
                </Badge>
                <span>{new Date(c.created_at).toLocaleString('es-CO')}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{c.body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-5 space-y-2">
          <textarea
            rows={3} value={body} onChange={(e) => setBody(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="Escriba un comentario..."
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
              Interno (no visible al ciudadano)
            </label>
            <Button onClick={add} disabled={busy || !body.trim()} size="sm">
              {busy ? 'Guardando...' : 'Comentar'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
