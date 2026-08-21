import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=%2Fonboarding");
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membership) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/60 sm:p-10">
        <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
          Primeiro acesso
        </div>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
          Configure sua organização
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Crie a primeira organização da plataforma. Você será cadastrado
          automaticamente como proprietário.
        </p>

        <OnboardingForm />
      </section>
    </main>
  );
}