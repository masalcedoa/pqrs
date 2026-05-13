'use client';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface Event {
  id: number | string;
  event_type: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

const eventTone: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  created: 'info',
  transition: 'info',
  assignment: 'info',
  comment: 'neutral',
  attachment: 'neutral',
  reminder: 'warning',
  ai_suggestion: 'neutral',
  notification: 'success',
  approval_request: 'warning',
  approval_decision: 'success',
  order_created: 'info',
  order_updated: 'neutral',
  overdue: 'danger',
  reopened: 'warning'
};

const labels: Record<string, string> = {
  transition: 'Cambio de estado',
  notification: 'Notificación',
  comment: 'Comentario',
  reminder: 'Recordatorio',
  ai_suggestion: 'Sugerencia IA',
  order_created: 'OT creada',
  approval_request: 'Solicitud de aprobación',
  approval_decision: 'Decisión',
  overdue: 'Vencimiento',
  created: 'Creado',
  assignment: 'Asignación'
};

export default function CaseTimeline({ events }: { events: Event[] }) {
  if (events.length === 0)
    return <Card><CardContent className="pt-5 text-sm text-gray-500">Sin eventos registrados.</CardContent></Card>;

  return (
    <Card>
      <CardContent className="pt-5">
        <ol className="relative space-y-4 border-l border-gray-200 pl-6">
          {events.map((e, i) => (
            <motion.li
              key={e.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              className="relative"
            >
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-brand-500 ring-4 ring-brand-100" />
              <div className="flex items-center gap-2">
                <Badge tone={eventTone[e.event_type] ?? 'neutral'}>{labels[e.event_type] ?? e.event_type}</Badge>
                <span className="text-xs text-gray-500">{new Date(e.created_at).toLocaleString('es-CO')}</span>
              </div>
              <pre className="mt-1 whitespace-pre-wrap text-xs text-gray-700">
                {summarize(e.event_type, e.payload)}
              </pre>
            </motion.li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function summarize(type: string, payload: Record<string, unknown>): string {
  if (type === 'transition') return `${payload.from} → ${payload.to}${payload.reason ? ` — ${payload.reason}` : ''}`;
  if (type === 'notification') return `Plantilla: ${payload.kind ?? '—'}`;
  if (type === 'order_created') return `OT ${payload.order_number} (${payload.type})`;
  if (type === 'overdue') return `Detectado vencimiento ${payload.detected_at}`;
  return JSON.stringify(payload);
}
