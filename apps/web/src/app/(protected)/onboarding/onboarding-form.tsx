"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function OnboardingForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [segment, setSegment] = useState("instituto");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName = name.trim();

    if (normalizedName.length < 3) {
      setErrorMessage("Informe um nome com pelo menos 3 caracteres.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const supabase = createClient();

      const slugBase = normalizedName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const slug = `${slugBase}-${crypto.randomUUID().slice(0, 8)}`;

      const { error } = await supabase.rpc(
        "create_organization_onboarding",
        {
          p_name: normalizedName,
          p_slug: slug,
          p_segment: segment,
        },
      );

      if (error) {
        if (error.message.includes("USER_ALREADY_HAS_ORGANIZATION")) {
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        if (error.message.includes("ORGANIZATION_SLUG_ALREADY_EXISTS")) {
          setErrorMessage(
            "Não foi possível gerar um identificador único. Tente novamente.",
          );
          return;
        }

        console.error("Erro no onboarding:", error);
        setErrorMessage("Não foi possível criar a organização.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Erro inesperado no onboarding:", error);
      setErrorMessage("Ocorreu um erro inesperado. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <div>
        <label
          className="mb-2 block text-sm font-medium text-slate-700"
          htmlFor="organization-name"
        >
          Nome da organização
        </label>

        <input
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-700 focus:ring-4 focus:ring-slate-100"
          disabled={isSubmitting}
          id="organization-name"
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Instituto Államo"
          required
          type="text"
          value={name}
        />
      </div>

      <div>
        <label
          className="mb-2 block text-sm font-medium text-slate-700"
          htmlFor="segment"
        >
          Segmento
        </label>

        <select
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-700 focus:ring-4 focus:ring-slate-100"
          disabled={isSubmitting}
          id="segment"
          onChange={(event) => setSegment(event.target.value)}
          value={segment}
        >
          <option value="instituto">Instituto</option>
          <option value="empresa">Empresa</option>
          <option value="ong">ONG</option>
          <option value="associacao">Associação</option>
          <option value="outro">Outro</option>
        </select>
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
        {isSubmitting ? "Criando organização..." : "Criar organização"}
      </button>
    </form>
  );
}