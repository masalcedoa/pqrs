'use client';
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

type Transition = {
  to: string;
  roles_allowed: string[];
  requires_approval?: string;
  requires_fields?: string[];
};

export default function TransitionPanel({ caseId, currentStatus }: { caseId: string; currentStatus: string }) {
  const [allowed, setAllowed] = useState<Transition[]>([]);
  const [reason, setReason]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/pqrs/${caseId}/transition`).then(r => r.json()).then(j => setAllowed(j.allowed ?? []));
  }, [caseId]);

  async function go(to: string) {
    setLoading(true); setError(null); setSuccess(null);
    try {
      const res = await fetch(`/api/pqrs/${caseId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, reason })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message ?? 'Error');
      setSuccess(`Transición a ${to} ejecutada`);
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acciones — workflow</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500">Estado actual</p>
        <Badge tone="info" className="mt-1">{currentStatus}</Badge>

        <textarea
          className="mt-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Motivo (opcional, queda registrado en bitácora)"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <div className="mt-3 grid gap-2">
          {allowed.length === 0 && <p className="text-sm text-gray-500">No tiene transiciones disponibles.</p>}
          {allowed.map(t => (
            <Button
              key={t.to} size="sm" variant="outline"
              disabled={loading}
              onClick={() => go(t.to)}
            >
              → {t.to}
              {t.requires_approval && <span className="ml-1 text-xs text-amber-600">(req. aprobación: {t.requires_approval})</span>}
            </Button>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-3 text-sm text-emerald-600">{success}</p>}
      </CardContent>
    </Card>
  );
}
