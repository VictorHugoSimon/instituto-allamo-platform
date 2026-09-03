import { Suspense } from "react";

import { CadastroForm } from "./cadastro-form";

export default function CadastroPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Instituto Államo
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-950">
          Criar sua conta
        </h1>

        <p className="mt-3 text-slate-600">
          Cadastre-se com o mesmo e-mail que recebeu o convite da sua organização.
        </p>

        <Suspense fallback={<p className="mt-8 text-sm text-slate-500">Carregando formulário...</p>}>
          <CadastroForm />
        </Suspense>
      </section>
    </main>
  );
}
