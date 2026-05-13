'use client';
import * as React from 'react';
import Link from 'next/link';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel,
  flexRender, type ColumnDef, type SortingState
} from '@tanstack/react-table';
import { Badge } from '@/components/ui/Badge';

export interface CaseRow {
  id: string;
  radicado: string;
  type: string;
  category: string | null;
  status: string;
  priority: string;
  received_at: string;
  due_at: string | null;
  assigned_to: string | null;
  age_days: number;
}

const priorityTone: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  baja: 'neutral', media: 'info', alta: 'warning', critica: 'danger'
};

export default function CaseQueueTable({ data }: { data: CaseRow[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'due_at', desc: false }]);
  const [filter, setFilter] = React.useState('');

  const columns: ColumnDef<CaseRow>[] = React.useMemo(() => [
    {
      accessorKey: 'radicado',
      header: 'Radicado',
      cell: ({ row }) =>
        <Link href={`/pqrs/${row.original.id}`} className="font-mono text-brand-600 hover:underline">
          {row.original.radicado}
        </Link>
    },
    { accessorKey: 'type',     header: 'Tipo' },
    { accessorKey: 'category', header: 'Categoría' },
    {
      accessorKey: 'priority', header: 'Prioridad',
      cell: ({ getValue }) => {
        const v = String(getValue());
        return <Badge tone={priorityTone[v] ?? 'neutral'}>{v}</Badge>;
      }
    },
    { accessorKey: 'status',   header: 'Estado' },
    {
      accessorKey: 'due_at', header: 'Vence',
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        if (!v) return '—';
        const overdue = new Date(v) < new Date();
        return <span className={overdue ? 'text-red-600 font-medium' : ''}>{new Date(v).toLocaleDateString('es-CO')}</span>;
      }
    },
    { accessorKey: 'age_days', header: 'Días' }
  ], []);

  const table = useReactTable({
    data, columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel()
  });

  return (
    <div className="rounded-xl border bg-white">
      <div className="border-b p-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar radicado, tipo, estado..."
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    className="cursor-pointer px-3 py-2 text-left font-medium text-gray-600 select-none"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{ asc: ' ▲', desc: ' ▼' }[h.column.getIsSorted() as string] ?? ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(r => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                {r.getVisibleCells().map(c => (
                  <td key={c.id} className="px-3 py-2">
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr><td colSpan={columns.length} className="p-6 text-center text-gray-500">Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
