"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

function ConviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const supabase = useMemo(() => createClient(), []);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const redirectPath = token ? `/convite?token=${encodeURIComponent(token)}` : "/convite";

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUserEmail(data.user?.email ?? null);
      setIsLoadingUser(false);
    });

    return () => {
      active = false;
    };
  }, [supabase]);

  async function acceptInvitation() {
    if (!token) {
      setErrorMessage("O link de convite está incompleto.");
      return;
    }

    setErrorMessage("");
    setIsAccepting(true);

    try {
      const { error } = await supabase.rpc("accept_organization_invitation", {
        p_token: token,
      });

      if (error) {
        const normalized = error.message.toLowerCase();

        if (normalized.includes("email_mismatch")) {
          setErrorMessage("Este convite pertence a outro e-mail. Entre com o endereço que recebeu o convite.");
        } else if (normalized.includes("expired")) {
          setErrorMessage("Este convite expirou. Solicite um novo link ao administrador.");
        } else if (normalized.includes("not_pending")) {
          setErrorMessage("Este convite já foi utilizado ou cancelado.");
        } else {
          setErrorMessage("Não foi possível aceitar o convite. Solicite um novo link ao administrador.");
        }
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage("Ocorreu um erro inesperado ao aceitar o convite.");
    } finally {
      setIsAccepting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
          Acesso à plataforma
        </p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
          Convite para sua organização
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          O acesso é individual e vinculado ao e-mail convidado. Nenhuma senha é compartilhada pelo administrador.
        </p>

        {!token ? (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            O token do convite não foi encontrado neste link.
          </div>
        ) : isLoadingUser ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            Validando sua sessão...
          </div>
        ) : userEmail ? (
          <div className="mt-8 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Conta autenticada</p>
              <p className="mt-2 font-semibold text-slate-950">{userEmail}</p>
            </div>

            {errorMessage ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {errorMessage}
              </div>
            ) : null}

            <button
              className="flex w-full items-center justify-center rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isAccepting}
              onClick={acceptInvitation}
              type="button"
            >
              {isAccepting ? "Liberando acesso..." : "Aceitar convite e entrar"}
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              Entre com o e-mail que recebeu o convite. Se ainda não tiver uma conta, crie uma antes de aceitar.
            </p>

            <Link
              className="flex w-full items-center justify-center rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800"
              href={`/login?redirectTo=${encodeURIComponent(redirectPath)}`}
            >
              Entrar e continuar
            </Link>

            <Link
              className="flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
              href={`/cadastro?redirectTo=${encodeURIComponent(redirectPath)}`}
            >
              Criar conta com o e-mail convidado
            </Link>
          </div>
        )}

        <p className="mt-8 text-center text-xs leading-5 text-slate-400">
          Instituto Államo · acesso protegido por organização e perfil de permissão
        </p>
      </section>
    </main>
  );
}

export default function ConvitePage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Carregando convite...</main>}>
      <ConviteContent />
    </Suspense>
  );
}
