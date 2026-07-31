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

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setErrorMessage("Preencha o e-mail e a senha.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        setErrorMessage(
          "Não foi possível entrar. Verifique o e-mail e a senha.",
        );
        return;
      }

      const redirectTo = getSafeRedirectPath(
        searchParams.get("redirectTo"),
      );

      router.replace(redirectTo);
      router.refresh();
    } catch {
      setErrorMessage(
        "Ocorreu um erro inesperado. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <div>
        <label
          className="mb-2 block text-sm font-medium text-slate-700"
          htmlFor="email"
        >
          E-mail
        </label>

        <input
          autoComplete="email"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-700 focus:ring-4 focus:ring-slate-100"
          disabled={isSubmitting}
          id="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="seuemail@empresa.com.br"
          required
          type="email"
          value={email}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-4">
          <label
            className="block text-sm font-medium text-slate-700"
            htmlFor="password"
          >
            Senha
          </label>

          <Link
            className="text-sm font-semibold text-slate-700 hover:text-slate-950"
            href="/recuperar-senha"
          >
            Esqueci minha senha
          </Link>
        </div>

        <div className="relative">
          <input
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-24 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-700 focus:ring-4 focus:ring-slate-100"
            disabled={isSubmitting}
            id="password"
            minLength={6}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Digite sua senha"
            required
            type={showPassword ? "text" : "password"}
            value={password}
          />

          <button
            className="absolute inset-y-0 right-0 px-4 text-sm font-semibold text-slate-600 hover:text-slate-950"
            onClick={() => setShowPassword((current) => !current)}
            type="button"
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div
          aria-live="polite"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}

      <button
        className="flex w-full items-center justify-center rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Entrando..." : "Entrar"}
      </button>

      <p className="text-center text-sm text-slate-600">
        Ainda não possui acesso?{" "}
        <Link
          className="font-semibold text-slate-950 hover:underline"
          href="/cadastro"
        >
          Criar conta
        </Link>
      </p>
    </form>
  );
}