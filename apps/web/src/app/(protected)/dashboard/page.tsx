import Link from "next/link";
import { redirect } from "next/navigation";

import { tenantHasModule } from "@/lib/tenants/catalog";
import { createClient } from "@/lib/supabase/server";

const defaultSummaryCards = [
  { label: "Projetos ativos", value: "0", description: "Nenhum projeto cadastrado" },
  { label: "Contatos", value: "0", description: "Base de relacionamento vazia" },
  { label: "Pendências", value: "0", description: "Nenhuma pendência crítica" },
  { label: "Documentos", value: "0", description: "Nenhum documento recente" },
];

function SemealiDashboard({ organizationName }: { organizationName: string }) {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-emerald-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
          {organizationName} · Sales Intelligence
        </p>
        <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
              Sua central comercial para território, carteira e execução.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-emerald-100 sm:text-base">
              A experiência Semeali reúne inteligência de mercado, CRM, rotas, aprovações, campo, atendimento e agentes de IA.
            </p>
          </div>
          <Link
            className="self-start rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-50 lg:self-auto"
            href="/dashboard/comercial"
          >
            Abrir Sales Intelligence
          </Link>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Prospects", "1.842", "Base demonstrativa mapeada"],
          ["Leads qualificados", "386", "Priorizados por score"],
          ["Pipeline potencial", "R$ 18,4 mi", "Dados demonstrativos"],
          ["Cobertura da meta", "72%", "Projeção demonstrativa"],
        ].map(([label, value, detail]) => (
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}>
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Jornada comercial integrada</h2>
              <p className="mt-1 text-sm text-slate-500">Do sinal de mercado à próxima melhor ação.</p>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-800">Demonstração</span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {["Mercado & oportunidades", "Carteira & CRM", "Agenda & rotas", "Vendas & aprovações", "Execução em campo", "IA & executivo"].map((item) => (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700" key={item}>{item}</div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Próxima decisão</p>
          <h2 className="mt-3 text-xl font-bold text-slate-950">Priorizar Rio Verde–Jataí</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            O cenário demonstrativo indica forte aderência para soja e milho, com cobertura comercial abaixo do potencial mapeado.
          </p>
          <Link className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800" href="/dashboard/comercial">
            Ver análise completa
          </Link>
        </article>
      </div>
    </div>
  );
}

function DefaultDashboard() {
  return (
    <div className="mx-auto max-w-7xl">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Visão geral</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Bem-vindo à plataforma</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Acompanhe os principais indicadores da organização e acesse os módulos operacionais em um único ambiente.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" type="button">Exportar visão</button>
            <button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800" type="button">Novo projeto</button>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {defaultSummaryCards.map((card) => (
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={card.label}>
            <p className="text-sm font-semibold text-slate-500">{card.label}</p>
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{card.value}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{card.description}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 px-6 py-5"><h2 className="text-lg font-bold text-slate-950">Atividades recentes</h2><p className="mt-1 text-sm text-slate-500">Atualizações mais recentes da organização.</p></header>
          <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-lg font-bold text-slate-500">A</div><h3 className="mt-4 font-bold text-slate-950">Nenhuma atividade registrada</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">As movimentações de projetos, usuários e documentos aparecerão neste espaço.</p></div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 px-6 py-5"><h2 className="text-lg font-bold text-slate-950">Próximos compromissos</h2><p className="mt-1 text-sm text-slate-500">Agenda resumida da organização.</p></header>
          <div className="space-y-3 p-6"><div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center"><p className="text-sm font-semibold text-slate-700">Agenda ainda não configurada</p><p className="mt-2 text-xs leading-5 text-slate-500">Reuniões, eventos e prazos serão exibidos aqui.</p></div></div>
        </article>
      </section>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirectTo=%2Fdashboard");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  const { data: organization } = await supabase
    .from("organizations")
    .select("name, slug")
    .eq("id", membership.organization_id)
    .single();

  if (!organization) redirect("/onboarding");

  if (tenantHasModule(organization.slug, "commercial")) {
    return <SemealiDashboard organizationName={organization.name} />;
  }

  return <DefaultDashboard />;
}
