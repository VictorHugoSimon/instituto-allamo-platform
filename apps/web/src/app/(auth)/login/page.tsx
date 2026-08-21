import { Suspense } from "react";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/60 sm:p-10">
        <div className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
          Instituto Államo
        </div>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
          Entrar na plataforma
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Acesse sua conta para acompanhar projetos, atividades e
          informações da sua organização.
        </p>

        <Suspense
          fallback={
            <p className="mt-8 text-sm text-slate-500">
              Carregando formulário...
            </p>
          }
        >
          <LoginForm />
        </Suspense>

        <p className="mt-8 text-center text-xs leading-5 text-slate-500">
          Ambiente seguro com autenticação e controle de acesso.
        </p>
      </section>
    </main>
  );
}