export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Instituto Államo
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Entrar na plataforma
        </h1>

        <p className="mt-3 text-slate-600">
          A autenticação será conectada ao Supabase na próxima etapa.
        </p>
      </section>
    </main>
  );
}