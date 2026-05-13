import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight text-brand-700">
        PQRS Energía
      </h1>
      <p className="mt-4 text-lg text-gray-700">
        Plataforma de gestión integral de peticiones, quejas, reclamos, solicitudes y recursos
        para empresas prestadoras del servicio público de energía en Colombia.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/radicar"
          className="rounded-xl border border-brand-100 bg-white p-6 shadow-sm hover:shadow-md transition"
        >
          <h2 className="text-xl font-semibold">Radicar una PQRS</h2>
          <p className="mt-1 text-sm text-gray-600">
            Diligencie su solicitud en minutos con la ayuda de nuestro asistente IA.
          </p>
        </Link>

        <Link
          href="/consultar"
          className="rounded-xl border border-brand-100 bg-white p-6 shadow-sm hover:shadow-md transition"
        >
          <h2 className="text-xl font-semibold">Consultar mi radicado</h2>
          <p className="mt-1 text-sm text-gray-600">Consulte el estado y la trazabilidad de su PQRS.</p>
        </Link>
      </div>

      <div className="mt-12 text-sm text-gray-500">
        <Link href="/login" className="underline">Acceso de funcionarios</Link>
      </div>
    </main>
  );
}
