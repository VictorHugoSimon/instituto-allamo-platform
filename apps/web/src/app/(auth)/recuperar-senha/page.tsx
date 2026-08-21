import Link from "next/link";

export default function RecuperarSenhaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Instituto Államo
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-950">
          Recuperar senha
        </h1>

        <p className="mt-3 text-slate-600">
          A recuperação de senha por e-mail será implementada na próxima
          etapa.
        </p>

        <Link
          className="mt-6 inline-block font-semibold text-slate-950 hover:underline"
          href="/login"
        >
          Voltar para o login
        </Link>
      </section>
    </main>
  );
}