'use client';

import { useState } from 'react';
import type { PqrsRadicacionInput, PqrsType, PqrsCategory } from '@/types/pqrs';

const TIPOS: { value: PqrsType; label: string }[] = [
  { value: 'peticion',           label: 'Petición' },
  { value: 'queja',              label: 'Queja' },
  { value: 'reclamo',            label: 'Reclamo' },
  { value: 'recurso_reposicion', label: 'Recurso de reposición' },
  { value: 'recurso_apelacion',  label: 'Recurso de apelación' },
  { value: 'denuncia',           label: 'Denuncia' },
  { value: 'solicitud_tecnica',  label: 'Solicitud técnica' }
];

const CATEGORIAS: { value: PqrsCategory; label: string }[] = [
  { value: 'facturacion',      label: 'Facturación' },
  { value: 'lectura',          label: 'Lectura' },
  { value: 'consumo_elevado',  label: 'Consumo elevado' },
  { value: 'suspension',       label: 'Suspensión' },
  { value: 'reconexion',       label: 'Reconexión' },
  { value: 'medidor',          label: 'Medidor' },
  { value: 'calidad_servicio', label: 'Calidad del servicio' },
  { value: 'dano_electrico',   label: 'Daño eléctrico' },
  { value: 'atencion_usuario', label: 'Atención al usuario' },
  { value: 'cobros',           label: 'Cobros' },
  { value: 'otro',             label: 'Otro' }
];

export default function PqrsForm() {
  const [submitting, setSubmitting] = useState(false);
  const [radicado, setRadicado]     = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);

    const payload: PqrsRadicacionInput = {
      customer: {
        kind:          (fd.get('kind')          as 'persona_natural' | 'persona_juridica') ?? 'persona_natural',
        document_type: fd.get('document_type')  as 'CC' | 'CE' | 'NIT' | 'TI' | 'PA',
        document_id:   String(fd.get('document_id')),
        full_name:     String(fd.get('full_name')),
        email:         String(fd.get('email')   ?? ''),
        phone:         String(fd.get('phone')   ?? '')
      },
      service_account: fd.get('account_number')
        ? {
            account_number: String(fd.get('account_number')),
            address:        String(fd.get('address') ?? ''),
            municipality:   String(fd.get('municipality') ?? '')
          }
        : undefined,
      type:       fd.get('type')     as PqrsType,
      category:   (fd.get('category') as PqrsCategory) || undefined,
      narrative:  String(fd.get('narrative')),
      channel:    'portal'
    };

    try {
      const res  = await fetch('/api/pqrs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No fue posible radicar');
      setRadicado(json.radicado);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (radicado) {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-emerald-600">PQRS radicada</h2>
        <p className="mt-2">Su número de radicado es:</p>
        <p className="mt-1 text-2xl font-mono">{radicado}</p>
        <p className="mt-4 text-sm text-gray-600">
          Recibirá notificación cuando avance el trámite. Le responderemos dentro del término
          legal aplicable.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-xl border bg-white p-6 shadow-sm">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de persona" name="kind" as="select" options={[
          { value: 'persona_natural',  label: 'Persona natural' },
          { value: 'persona_juridica', label: 'Persona jurídica' }
        ]} />
        <Field label="Tipo documento" name="document_type" as="select" options={[
          { value: 'CC', label: 'CC' }, { value: 'CE', label: 'CE' },
          { value: 'NIT', label: 'NIT' }, { value: 'TI', label: 'TI' }, { value: 'PA', label: 'PA' }
        ]} />
        <Field label="Número documento" name="document_id" required />
        <Field label="Nombre completo / Razón social" name="full_name" required />
        <Field label="Correo electrónico" name="email" type="email" />
        <Field label="Teléfono" name="phone" />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <Field label="Número de cuenta contrato" name="account_number" />
        <Field label="Municipio" name="municipality" />
        <Field label="Dirección de prestación" name="address" className="sm:col-span-2" />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de PQRS" name="type" as="select" required
               options={TIPOS.map(t => ({ value: t.value, label: t.label }))} />
        <Field label="Categoría" name="category" as="select"
               options={[{ value: '', label: '(detectar automáticamente)' },
                         ...CATEGORIAS.map(c => ({ value: c.value, label: c.label }))]} />
      </fieldset>

      <div>
        <label className="text-sm font-medium">Descripción del hecho</label>
        <textarea
          name="narrative" required minLength={20}
          rows={6}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
          placeholder="Describa con detalle la situación, fechas, valores y evidencias disponibles..."
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit" disabled={submitting}
        className="rounded-md bg-brand-600 px-5 py-2.5 text-white font-medium disabled:opacity-60"
      >
        {submitting ? 'Radicando...' : 'Radicar PQRS'}
      </button>
    </form>
  );
}

type FieldProps = {
  label: string; name: string; required?: boolean; type?: string;
  as?: 'input' | 'select'; options?: { value: string; label: string }[];
  className?: string;
};
function Field({ label, name, required, type = 'text', as = 'input', options, className }: FieldProps) {
  return (
    <div className={className}>
      <label className="text-sm font-medium">{label}{required && <span className="text-red-500"> *</span>}</label>
      {as === 'select' ? (
        <select
          name={name} required={required}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:border-brand-500 focus:outline-none"
        >
          {options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          name={name} type={type} required={required}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
        />
      )}
    </div>
  );
}
