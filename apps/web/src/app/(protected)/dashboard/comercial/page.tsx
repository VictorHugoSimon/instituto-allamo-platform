import { redirect } from "next/navigation";

import { SemealiLiveWorkspace } from "@/components/commercial/semeali-live-workspace";
import { SemealiSalesWorkspace } from "@/components/commercial/semeali-sales-workspace";
import { tenantHasModule } from "@/lib/tenants/catalog";
import { createClient } from "@/lib/supabase/server";

type LiveSummary = {
  accounts: number;
  prospects: number;
  qualifiedOpportunities: number;
  openOpportunities: number;
  pipelineValue: number;
  pipelineHectares: number;
  pendingApprovals: number;
  visitsLast30Days: number;
};

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSummary(value: unknown): LiveSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const summary = value as Record<string, unknown>;

  return {
    accounts: toNumber(summary.accounts),
    prospects: toNumber(summary.prospects),
    qualifiedOpportunities: toNumber(summary.qualifiedOpportunities),
    openOpportunities: toNumber(summary.openOpportunities),
    pipelineValue: toNumber(summary.pipelineValue),
    pipelineHectares: toNumber(summary.pipelineHectares),
    pendingApprovals: toNumber(summary.pendingApprovals),
    visitsLast30Days: toNumber(summary.visitsLast30Days),
  };
}

function hasLiveCommercialData(summary: LiveSummary | null, opportunities: unknown[]) {
  if (opportunities.length > 0) return true;
  if (!summary) return false;

  return Object.values(summary).some((value) => value > 0);
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

  const summary = summaryResult.error
    ? null
    : normalizeSummary(summaryResult.data);

  const opportunities =
    !opportunitiesResult.error && Array.isArray(opportunitiesResult.data)
      ? opportunitiesResult.data
      : [];

  if (hasLiveCommercialData(summary, opportunities)) {
    return (
      <SemealiLiveWorkspace
        opportunities={opportunities}
        organizationName={organization.name}
        summary={summary ?? {
          accounts: 0,
          prospects: 0,
          qualifiedOpportunities: 0,
          openOpportunities: 0,
          pipelineValue: 0,
          pipelineHectares: 0,
          pendingApprovals: 0,
          visitsLast30Days: 0,
        }}
      />
    );
  }

  return <SemealiSalesWorkspace organizationName={organization.name} />;
}
