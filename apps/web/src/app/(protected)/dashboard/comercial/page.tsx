import { redirect } from "next/navigation";

import { SemealiLiveWorkspace } from "@/components/commercial/semeali-live-workspace";
import { SemealiSalesWorkspace } from "@/components/commercial/semeali-sales-workspace";
import { tenantHasModule } from "@/lib/tenants/catalog";
import { createClient } from "@/lib/supabase/server";

function hasLiveCommercialData(
  summary: Record<string, unknown> | null,
  opportunities: unknown[],
) {
  if (opportunities.length > 0) return true;
  if (!summary) return false;

  return [
    "accounts",
    "prospects",
    "qualifiedOpportunities",
    "openOpportunities",
    "pipelineValue",
    "pipelineHectares",
    "pendingApprovals",
    "visitsLast30Days",
  ].some((key) => Number(summary[key] ?? 0) > 0);
}

export default async function CommercialPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=%2Fdashboard%2Fcomercial");
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("id", membership.organization_id)
    .single();

  if (!organization) {
    redirect("/onboarding");
  }

  if (!tenantHasModule(organization.slug, "commercial")) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
          Módulo não contratado
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">
          Comercial & Inteligência
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Este módulo não está habilitado para a organização ativa.
        </p>
      </section>
    );
  }

  const [summaryResult, opportunitiesResult] = await Promise.all([
    supabase.rpc("commercial_workspace_summary", {
      p_organization_id: organization.id,
    }),
    supabase.rpc("list_commercial_opportunities", {
      p_organization_id: organization.id,
      p_limit: 100,
    }),
  ]);

  const summary =
    !summaryResult.error &&
    summaryResult.data &&
    typeof summaryResult.data === "object" &&
    !Array.isArray(summaryResult.data)
      ? (summaryResult.data as Record<string, unknown>)
      : null;

  const opportunities =
    !opportunitiesResult.error && Array.isArray(opportunitiesResult.data)
      ? opportunitiesResult.data
      : [];

  if (hasLiveCommercialData(summary, opportunities)) {
    return (
      <SemealiLiveWorkspace
        opportunities={opportunities}
        organizationName={organization.name}
        summary={summary ?? {}}
      />
    );
  }

  return <SemealiSalesWorkspace organizationName={organization.name} />;
}
