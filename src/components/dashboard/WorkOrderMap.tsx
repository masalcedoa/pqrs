'use client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export interface OrderPoint {
  id: string;
  order_number: string;
  type: string;
  status: string;
  lat: number;
  lng: number;
  address: string | null;
  assigned_to_name: string | null;
}

/**
 * Mapa simplificado por listado geolocalizado.
 * Para producción, reemplazar por Leaflet/MapLibre (no se incluye dep para no inflar bundle).
 * El componente acepta `points` listos para renderizar como tarjetas + clusters por municipio.
 */
export default function WorkOrderMap({ points }: { points: OrderPoint[] }) {
  const byMuni = points.reduce<Record<string, OrderPoint[]>>((acc, p) => {
    const key = p.address?.split(',').pop()?.trim() ?? 'Sin municipio';
    acc[key] ??= [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Órdenes activas — distribución geográfica</CardTitle>
      </CardHeader>
      <CardContent>
        {Object.keys(byMuni).length === 0
          ? <p className="text-sm text-gray-500">Sin órdenes activas con geolocalización.</p>
          : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(byMuni).map(([muni, list]) => (
                <div key={muni} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">{muni}</h4>
                    <Badge tone="info">{list.length}</Badge>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-gray-600">
                    {list.slice(0, 5).map(p => (
                      <li key={p.id} className="flex justify-between">
                        <span className="font-mono">{p.order_number}</span>
                        <span>{p.type}</span>
                      </li>
                    ))}
                    {list.length > 5 && <li className="text-gray-400">+{list.length - 5} más</li>}
                  </ul>
                </div>
              ))}
            </div>
          )}
      </CardContent>
    </Card>
  );
}
