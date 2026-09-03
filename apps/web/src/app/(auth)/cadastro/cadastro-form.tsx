"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { createClient } from "@/lib/supabase/client";

function getSafeRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

export function CadastroForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedName.length < 2) {
      setErrorMessage("Informe seu nome completo.");
      return;
    }

    if (!normalizedEmail || !password) {
      setErrorMessage("Preencha o e-mail e a senha.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== passwordConfirmation) {
      setErrorMessage("As senhas não conferem.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const redirectTo = getSafeRedirectPath(searchParams.get("redirectTo"));
      const emailRedirectTo = `${window.location.origin}${redirectTo}`;

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: normalizedName,
          },
          emailRedirectTo,
        },
      });

      if (error) {
        setErrorMessage(
          "Não foi possível criar a conta. Verifique os dados e tente novamente.",
        );
        return;
      }

      if (!data.session) {
        setSuccessMessage(
          "Conta criada. Confira seu e-mail para confirmar o cadastro e depois continue pelo link de acesso recebido.",
        );
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch {
      setErrorMessage("Ocorreu um erro inesperado. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="fullName">
          Nome completo
        </label>
        <input
          autoComplete="name"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-700 focus:ring-4 focus:ring-slate-100"
          disabled={isSubmitting}
          id="fullName"
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Seu nome"
          required
          value={fullName}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="email">
          E-mail corporativo
        </label>
        <input
          autoComplete="email"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-700 focus:ring-4 focus:ring-slate-100"
          disabled={isSubmitting}
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nome@empresa.com.br"
          required
          type="email"
          value={email}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="password">
            Senha
          </label>
          <input
            autoComplete="new-password"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-700 focus:ring-4 focus:ring-slate-100"
            disabled={isSubmitting}
            id="password"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="passwordConfirmation">
            Confirmar senha
          </label>
          <input
            autoComplete="new-password"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-700 focus:ring-4 focus:ring-slate-100"
            disabled={isSubmitting}
            id="passwordConfirmation"
            minLength={8}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            required
            type="password"
            value={passwordConfirmation}
          />
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          {successMessage}
        </div>
      ) : null}

      <button
        className="flex w-full items-center justify-center rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Criando conta..." : "Criar conta"}
      </button>

      <p className="text-center text-sm text-slate-600">
        Já possui acesso?{" "}
        <Link className="font-semibold text-slate-950 hover:underline" href={`/login${searchParams.get("redirectTo") ? `?redirectTo=${encodeURIComponent(getSafeRedirectPath(searchParams.get("redirectTo")))}` : ""}`}>
          Entrar
        </Link>
      </p>
    </form>
  );
}
