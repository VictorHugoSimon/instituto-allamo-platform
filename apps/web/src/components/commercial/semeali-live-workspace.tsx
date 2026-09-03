type CommercialSummary = {
  accounts?: number;
  prospects?: number;
  qualifiedOpportunities?: number;
  openOpportunities?: number;
  pipelineValue?: number;
  pipelineHectares?: number;
  pendingApprovals?: number;
  visitsLast30Days?: number;
};

type CommercialOpportunity = {
  opportunity_id: string;
  account_id: string;
  account_name: string;
  city: string | null;
  state: string | null;
  title: string;
  crop: string | null;
  stage: string;
  status: string;
  score: number;
  potential_value: number | null;
  potential_hectares: number | null;
  probability: number;
  expected_close_date: string | null;
};

type Props = {
  organizationName: string;
  summary: CommercialSummary;
  opportunities: CommercialOpportunity[];
};

const stageLabels: Record<string, string> = {
  mapped: "Mapeada",
  qualified: "Qualificada",
  contact: "Contato",
  diagnosis: "Diagnóstico",
  proposal: "Proposta",
  negotiation: "Negociação",
  won: "Ganha",
  lost: "Perdida",
};

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatNumber(value: number | null | undefined, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits,
  }).format(Number(value ?? 0));
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

export function SemealiLiveWorkspace({
  organizationName,
  summary,
  opportunities,
}: Props) {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-emerald-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
                {organizationName} · Sales Intelligence
              </p>
              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-100">
                Dados reais do tenant
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
              Operação comercial conectada à base multiempresa.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-emerald-100 sm:text-base">
              Os indicadores abaixo são calculados diretamente a partir dos registros da organização autenticada e respeitam as permissões do usuário.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Prospects e leads"
          value={formatNumber(summary.prospects)}
          detail={`${formatNumber(summary.accounts)} contas ativas na carteira.`}
        />
        <StatCard
          label="Oportunidades abertas"
          value={formatNumber(summary.openOpportunities)}
          detail={`${formatNumber(summary.qualifiedOpportunities)} já avançaram além do mapeamento.`}
        />
        <StatCard
          label="Pipeline potencial"
          value={formatCurrency(summary.pipelineValue)}
          detail={`${formatNumber(summary.pipelineHectares, 1)} ha em oportunidades abertas.`}
        />
        <StatCard
          label="Execução e governança"
          value={`${formatNumber(summary.visitsLast30Days)} visitas`}
          detail={`${formatNumber(summary.pendingApprovals)} aprovações comerciais pendentes.`}
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-col justify-between gap-3 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Pipeline real
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              Oportunidades priorizadas
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Ordenação por score e atualização mais recente.
            </p>
          </div>
          <span className="text-sm font-semibold text-slate-500">
            {opportunities.length} exibidas
          </span>
        </header>

        {opportunities.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3">Conta / oportunidade</th>
                  <th className="px-6 py-3">Cultura</th>
                  <th className="px-6 py-3">Score</th>
                  <th className="px-6 py-3">Potencial</th>
                  <th className="px-6 py-3">Hectares</th>
                  <th className="px-6 py-3">Estágio</th>
                  <th className="px-6 py-3">Prob.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {opportunities.map((item) => (
                  <tr key={item.opportunity_id}>
                    <td className="px-6 py-4">
                      <strong className="block text-slate-950">
                        {item.account_name}
                      </strong>
                      <span className="mt-1 block text-xs text-slate-500">
                        {item.title}
                        {item.city || item.state
                          ? ` · ${[item.city, item.state].filter(Boolean).join("/")}`
                          : ""}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {item.crop || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        {item.score}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {formatCurrency(item.potential_value)}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {item.potential_hectares == null
                        ? "—"
                        : `${formatNumber(item.potential_hectares, 1)} ha`}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {stageLabels[item.stage] ?? item.stage}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {item.probability}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <h3 className="font-bold text-slate-950">
              Nenhuma oportunidade cadastrada
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
              A base comercial já está preparada. Cadastre contas e oportunidades para substituir integralmente o conteúdo demonstrativo.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
