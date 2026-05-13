import PqrsForm from '@/components/pqrs/PqrsForm';
import AiChat from '@/components/ai/AiChat';

export const metadata = { title: 'Radicar PQRS — PQRS Energía' };

export default function RadicarPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-bold text-brand-700">Radicar una PQRS</h1>
      <p className="mt-2 text-gray-600">
        Diligencie el formulario o utilice el asistente IA para guiar su solicitud.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PqrsForm />
        </div>
        <aside className="lg:col-span-1">
          <AiChat />
        </aside>
      </div>
    </main>
  );
}
