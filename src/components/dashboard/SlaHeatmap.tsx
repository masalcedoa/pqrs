'use client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils/cn';

export interface SlaCell { row: string; col: string; pct: number; total: number; }

/**
 * Heatmap simple sin librería externa: matriz row × col coloreada por cumplimiento.
 * Verde >= 95%, ámbar 80-95%, rojo < 80%.
 */
export default function SlaHeatmap({ data, rows, cols }: {
  data: SlaCell[]; rows: string[]; cols: string[];
}) {
  const get = (r: string, c: string) => data.find(d => d.row === r && d.col === c);
  return (
    <Card>
      <CardHeader>
        <CardTitle>SLA por área × causal (% cumplimiento)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="p-2" />
                {cols.map(c => <th key={c} className="px-2 py-1 text-left font-medium text-gray-500">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r}>
                  <td className="pr-3 text-gray-600 font-medium">{r}</td>
                  {cols.map(c => {
                    const cell = get(r, c);
                    const pct = cell?.pct ?? 0;
                    const total = cell?.total ?? 0;
                    return (
                      <td key={c} className="p-1">
                        <div
                          title={`${r} · ${c}: ${pct}% (${total})`}
                          className={cn(
                            'h-9 w-16 rounded flex items-center justify-center text-[11px] font-semibold',
                            !cell                ? 'bg-gray-50 text-gray-300' :
                            pct >= 95            ? 'bg-emerald-200 text-emerald-900' :
                            pct >= 80            ? 'bg-amber-200 text-amber-900'  :
                                                   'bg-red-200 text-red-900'
                          )}
                        >
                          {cell ? `${pct}%` : '—'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
