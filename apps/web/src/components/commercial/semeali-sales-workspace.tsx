"use client";

import { useMemo, useState } from "react";

type SectionId =
  | "overview"
  | "opportunities"
  | "territory"
  | "crm"
  | "sales"
  | "field"
  | "support"
  | "content"
  | "ai"
  | "executive";

const sections: { id: SectionId; label: string }[] = [
  { id: "overview", label: "Visão geral" },
  { id: "opportunities", label: "Oportunidades" },
  { id: "territory", label: "Mercado & território" },
  { id: "crm", label: "Carteira & CRM" },
  { id: "sales", label: "Vendas & aprovações" },
  { id: "field", label: "Execução em campo" },
  { id: "support", label: "Atendimento" },
  { id: "content", label: "Conteúdo & engajamento" },
  { id: "ai", label: "Agentes de IA" },
  { id: "executive", label: "Executivo" },
];

const opportunities = [
  { account: "Grupo Horizonte Rural", city: "Rio Verde/GO", crop: "Soja", score: 94, potential: "2.800 ha", stage: "Proposta" },
  { account: "Agrovale Insumos", city: "Maringá/PR", crop: "Milho", score: 91, potential: "R$ 1,2 mi", stage: "Diagnóstico" },
  { account: "Fazenda Santa Helena", city: "Araçatuba/SP", crop: "Sorgo", score: 88, potential: "1.450 ha", stage: "Contato" },
  { account: "Cooperativa Campo Forte", city: "Dourados/MS", crop: "Milho", score: 84, potential: "R$ 920 mil", stage: "Qualificação" },
  { account: "Agro Norte Distribuição", city: "Londrina/PR", crop: "Soja", score: 82, potential: "R$ 780 mil", stage: "Mapeado" },
];

const regionRanking = [
  { region: "Rio Verde / Jataí", state: "GO", score: 96, leads: 32, crops: "Soja e milho", potential: "R$ 6,4 mi" },
  { region: "Norte do Paraná", state: "PR", score: 91, leads: 41, crops: "Soja", potential: "R$ 4,7 mi" },
  { region: "Noroeste Paulista", state: "SP", score: 88, leads: 56, crops: "Milho e sorgo", potential: "R$ 5,8 mi" },
  { region: "Sul de Mato Grosso do Sul", state: "MS", score: 82, leads: 27, crops: "Milho", potential: "R$ 1,5 mi" },
];

const fieldCapabilities = [
  ["Agenda e rotas", "Planejamento de visitas por prioridade, região e janela comercial."],
  ["Projeção semanal", "Visitas, prospecções e meta planejada pelo representante."],
  ["Plano de ação", "Ações, responsáveis, clientes-alvo, prazo e evolução."],
  ["Relatório de visita", "Registro do encontro, assunto, próxima ação, fotos e evidências."],
  ["Mapa da equipe", "Posição de campo apenas durante uso autorizado do aplicativo."],
  ["Perdas", "Motivo da oportunidade perdida para alimentar melhoria comercial."],
];

const supportCapabilities = [
  ["Reclamações", "Protocolo do cliente com anexos, fotos, responsável, SLA e histórico."],
  ["Protocolo técnico", "Formulários específicos por cultura ou ocorrência com evidências de campo."],
  ["Chamados internos", "Solicitações para logística, faturamento, crédito, tecnologia e outras áreas."],
  ["Frete", "Estimativa comercial de frete e encaminhamento para cotação oficial."],
  ["Carga e entrega", "Acompanhamento de pedido, expedição, trânsito e entrega."],
];

const contentCapabilities = [
  ["Campanhas", "Campanhas comerciais por período, região, produto e público."],
  ["Materiais técnicos", "Catálogos, apresentações, laudos e conteúdos para compartilhar com clientes."],
  ["Treinamentos", "Trilhas de capacitação técnica e comercial por perfil."],
  ["Políticas", "Política comercial, crédito e regras operacionais versionadas."],
  ["Notificações", "Avisos direcionados com confirmação de leitura."],
  ["Gamificação", "Pontos, níveis e reconhecimento por ações relevantes, sem premiar volume vazio."],
];

const agents = [
  ["Radar de mercado", "Prioriza regiões, produtores, revendas e sinais de demanda."],
  ["Qualificador de leads", "Calcula score por hectares, cultura, janela, relacionamento e aderência."],
  ["Planejador territorial", "Agrupa oportunidades e sugere sequência de contatos e visitas."],
  ["Copiloto do representante", "Prepara contexto, abordagem, objeções prováveis e próxima melhor ação."],
  ["Gestor de campanhas", "Sugere segmentos e acompanha contato, resposta, proposta e conversão."],
  ["Copiloto executivo", "Resume riscos, previsão, desvios, cobertura de meta e decisões recomendadas."],
];

function DemoBadge() {
  return (
    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-800">
      Dados demonstrativos
    </span>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function CapabilityGrid({ items }: { items: string[][] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map(([title, description]) => (
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={title}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white">
            {title.slice(0, 2).toUpperCase()}
          </div>
          <h3 className="mt-4 font-bold text-slate-950">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </article>
      ))}
    </div>
  );
}

export function SemealiSalesWorkspace({ organizationName }: { organizationName: string }) {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [search, setSearch] = useState("");
  const [crop, setCrop] = useState("Todas");
  const [toast, setToast] = useState("");

  const filteredOpportunities = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return opportunities.filter((item) => {
      const matchesSearch =
        !normalized ||
        `${item.account} ${item.city} ${item.crop} ${item.stage}`.toLowerCase().includes(normalized);
      const matchesCrop = crop === "Todas" || item.crop === crop;
      return matchesSearch && matchesCrop;
    });
  }, [search, crop]);

  function demoAction(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-emerald-950 text-white shadow-sm">
        <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
                {organizationName} · Sales Intelligence
              </p>
              <DemoBadge />
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
              Da oportunidade no território ao pedido fechado.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-emerald-100 sm:text-base">
              Inteligência de mercado, CRM, execução em campo, governança comercial e agentes de IA em uma única jornada.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">Meta comercial demonstrativa</p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <strong className="text-3xl">R$ 24,0 mi</strong>
              <span className="text-sm font-semibold text-emerald-100">72% cobertura</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full w-[72%] rounded-full bg-amber-300" />
            </div>
            <p className="mt-3 text-xs text-emerald-100">R$ 17,3 mi projetados na carteira demonstrativa.</p>
          </div>
        </div>
      </section>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex min-w-max gap-1">
          {sections.map((section) => (
            <button
              className={[
                "rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                activeSection === section.id
                  ? "bg-slate-950 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
              ].join(" ")}
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              type="button"
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {activeSection === "overview" ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Prospects mapeados" value="1.842" detail="Sinais de mercado e contas ainda não trabalhadas." />
            <StatCard label="Leads qualificados" value="386" detail="Priorizados por score e aderência comercial." />
            <StatCard label="Pipeline potencial" value="R$ 18,4 mi" detail="Somatório demonstrativo das oportunidades ativas." />
            <StatCard label="Hectares em oportunidade" value="48,7 mil" detail="Área potencial nas contas qualificadas." />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                <div>
                  <h2 className="font-bold text-slate-950">Funil comercial</h2>
                  <p className="mt-1 text-sm text-slate-500">Do mapeamento à conversão.</p>
                </div>
                <DemoBadge />
              </header>
              <div className="space-y-4 p-6">
                {[
                  ["Mapeados", "1.842", "100%"],
                  ["Qualificados", "386", "72%"],
                  ["Contato", "214", "55%"],
                  ["Proposta", "83", "35%"],
                  ["Negociação", "41", "22%"],
                ].map(([label, value, width]) => (
                  <div className="grid grid-cols-[100px_1fr_60px] items-center gap-3" key={label}>
                    <span className="text-sm font-semibold text-slate-600">{label}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-700" style={{ width }} />
                    </div>
                    <strong className="text-right text-sm text-slate-950">{value}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-700">Recomendação</p>
              <h2 className="mt-3 text-xl font-bold text-slate-950">Priorizar Rio Verde–Jataí</h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Há 46 contas qualificadas, cobertura comercial abaixo da média e forte aderência ao portfólio de soja e milho.
              </p>
              <button
                className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                onClick={() => demoAction("Plano demonstrativo criado para Rio Verde–Jataí.")}
                type="button"
              >
                Transformar em plano
              </button>
            </article>
          </div>
        </div>
      ) : null}

      {activeSection === "opportunities" ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Oportunidades priorizadas</h2>
                <p className="mt-1 text-sm text-slate-500">Score, cultura, potencial e estágio para orientar a próxima ação.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-700 focus:ring-4 focus:ring-slate-100"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar conta ou região"
                  value={search}
                />
                <select
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-700 focus:ring-4 focus:ring-slate-100"
                  onChange={(event) => setCrop(event.target.value)}
                  value={crop}
                >
                  <option>Todas</option>
                  <option>Soja</option>
                  <option>Milho</option>
                  <option>Sorgo</option>
                </select>
              </div>
            </div>
          </header>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3">Conta</th>
                  <th className="px-6 py-3">Cultura</th>
                  <th className="px-6 py-3">Score</th>
                  <th className="px-6 py-3">Potencial</th>
                  <th className="px-6 py-3">Estágio</th>
                  <th className="px-6 py-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOpportunities.map((item) => (
                  <tr key={item.account}>
                    <td className="px-6 py-4">
                      <strong className="block text-slate-950">{item.account}</strong>
                      <span className="mt-1 block text-xs text-slate-500">{item.city}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{item.crop}</td>
                    <td className="px-6 py-4"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{item.score}</span></td>
                    <td className="px-6 py-4 font-semibold text-slate-700">{item.potential}</td>
                    <td className="px-6 py-4 text-slate-600">{item.stage}</td>
                    <td className="px-6 py-4">
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        onClick={() => demoAction(`Briefing demonstrativo preparado para ${item.account}.`)}
                        type="button"
                      >
                        Preparar abordagem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeSection === "territory" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {regionRanking.map((item, index) => (
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={item.region}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950 text-sm font-bold text-white">{index + 1}</div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">Score {item.score}</span>
                </div>
                <h3 className="mt-4 font-bold text-slate-950">{item.region}</h3>
                <p className="mt-1 text-sm text-slate-500">{item.state} · {item.crops}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
                  <div><span className="block text-xs text-slate-400">Leads</span><strong>{item.leads}</strong></div>
                  <div><span className="block text-xs text-slate-400">Potencial</span><strong>{item.potential}</strong></div>
                </div>
              </article>
            ))}
          </div>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="min-h-80 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 p-6">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Camada territorial</p>
                <h2 className="mt-3 text-xl font-bold text-slate-950">Mapa de mercado e cobertura</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  Espaço preparado para georreferenciar clientes, prospects, hectares, culturas, revendas, rotas, visitas e cobertura da equipe. A fonte real será definida por integração e base autorizada da Semeali.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {["Potencial de venda", "Hectares", "Leads sem contato", "Cobertura por representante"].map((label) => (
                    <div className="rounded-xl border border-emerald-200 bg-white p-4 text-sm font-semibold text-slate-700" key={label}>{label}</div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-bold text-slate-950">Decisões territoriais</h3>
                {["Criar rota otimizada", "Redistribuir carteira", "Abrir campanha regional", "Comparar cobertura x potencial"].map((label) => (
                  <button
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    key={label}
                    onClick={() => demoAction(`${label}: ação demonstrativa registrada.`)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </article>
        </div>
      ) : null}

      {activeSection === "crm" ? (
        <div className="grid gap-5 xl:grid-cols-3">
          {opportunities.slice(0, 3).map((item) => (
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" key={item.account}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-950">{item.account}</h3>
                  <p className="mt-1 text-sm text-slate-500">{item.city}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{item.score}</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 border-y border-slate-100 py-4 text-sm">
                <div><span className="block text-xs text-slate-400">Interesse</span><strong>{item.crop}</strong></div>
                <div><span className="block text-xs text-slate-400">Potencial</span><strong>{item.potential}</strong></div>
                <div><span className="block text-xs text-slate-400">Estágio</span><strong>{item.stage}</strong></div>
                <div><span className="block text-xs text-slate-400">Próxima ação</span><strong>Contato técnico</strong></div>
              </div>
              <div className="mt-5 flex gap-2">
                <button className="flex-1 rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-bold text-white" onClick={() => demoAction(`Contato demonstrativo registrado para ${item.account}.`)} type="button">Registrar contato</button>
                <button className="rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold text-slate-700" onClick={() => demoAction(`Histórico demonstrativo de ${item.account} aberto.`)} type="button">Histórico</button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {activeSection === "sales" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Pedidos em análise" value="18" detail="Integração com ERP prevista para ambiente real." />
            <StatCard label="Aprovações pendentes" value="7" detail="Descontos acima da alçada do representante." />
            <StatCard label="Comissão projetada" value="R$ 184 mil" detail="Valor demonstrativo conforme regras comerciais." />
            <StatCard label="Perdas no período" value="R$ 620 mil" detail="Preço, prazo, concorrência e outros motivos." />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="border-b border-slate-200 px-6 py-5"><h2 className="font-bold text-slate-950">Aprovações de desconto</h2><p className="mt-1 text-sm text-slate-500">Escalonamento por alçada, com justificativa e histórico.</p></header>
              <div className="divide-y divide-slate-100">
                {[
                  ["Grupo Horizonte Rural", "8,0%", "Regional"],
                  ["Agrovale Insumos", "5,5%", "Supervisor"],
                  ["Campo Forte", "10,0%", "Diretoria comercial"],
                ].map(([account, discount, level]) => (
                  <div className="flex items-center justify-between gap-4 px-6 py-4" key={account}>
                    <div><strong className="text-sm text-slate-950">{account}</strong><p className="mt-1 text-xs text-slate-500">{discount} · alçada {level}</p></div>
                    <button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700" onClick={() => demoAction(`Análise demonstrativa aberta para ${account}.`)} type="button">Analisar</button>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-bold text-slate-950">Ferramentas comerciais</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["Tabela de preços", "Versão vigente por produto, região e condição."],
                  ["Comissões", "Regras e projeção por pedido e vendedor."],
                  ["Política comercial", "Regras versionadas e disponibilizadas por perfil."],
                  ["Política de crédito", "Critérios, limites, condições e orientações."],
                ].map(([title, description]) => (
                  <button className="rounded-xl border border-slate-200 p-4 text-left hover:bg-slate-50" key={title} onClick={() => demoAction(`${title}: módulo demonstrativo aberto.`)} type="button">
                    <strong className="text-sm text-slate-950">{title}</strong>
                    <span className="mt-2 block text-xs leading-5 text-slate-500">{description}</span>
                  </button>
                ))}
              </div>
            </article>
          </div>
        </div>
      ) : null}

      {activeSection === "field" ? <CapabilityGrid items={fieldCapabilities} /> : null}
      {activeSection === "support" ? <CapabilityGrid items={supportCapabilities} /> : null}
      {activeSection === "content" ? <CapabilityGrid items={contentCapabilities} /> : null}

      {activeSection === "ai" ? (
        <div className="space-y-6">
          <CapabilityGrid items={agents} />
          <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Governança da IA</p>
            <h2 className="mt-3 text-xl font-bold text-slate-950">Agentes recomendam; regras críticas continuam governadas.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
              Preço, desconto, crédito, aprovação e demais decisões sensíveis devem respeitar permissões, alçadas, trilha de auditoria e fonte oficial de dados. A IA entra para priorizar e preparar a decisão, não para contornar a governança.
            </p>
          </article>
        </div>
      ) : null}

      {activeSection === "executive" ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Cobertura da meta" value="72%" detail="Pipeline projetado contra a meta demonstrativa." />
            <StatCard label="Pipeline / gap" value="4,8x" detail="Cobertura potencial sobre o valor ainda necessário." />
            <StatCard label="Conversão projetada" value="18,6%" detail="Estimativa demonstrativa da carteira atual." />
            <StatCard label="Ciclo médio" value="31 dias" detail="Tempo médio demonstrativo entre qualificação e pedido." />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4"><div><h2 className="font-bold text-slate-950">Pipeline por cultura</h2><p className="mt-1 text-sm text-slate-500">Composição demonstrativa do potencial.</p></div><DemoBadge /></div>
              <div className="mt-6 space-y-4">
                {[
                  ["Soja", "44%", "44%"],
                  ["Milho", "28%", "28%"],
                  ["Sorgo", "28%", "28%"],
                ].map(([label, value, width]) => (
                  <div key={label}><div className="mb-2 flex justify-between text-sm"><span className="font-semibold text-slate-700">{label}</span><strong>{value}</strong></div><div className="h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-emerald-700" style={{ width }} /></div></div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-bold text-slate-950">Atenções executivas</h2>
              <div className="mt-4 space-y-3">
                {[
                  ["Cobertura comercial", "Norte do Paraná ainda abaixo do potencial mapeado."],
                  ["Conversão", "Propostas de milho estão envelhecendo acima da média."],
                  ["Adoção", "Acompanhamento de uso do app deve entrar na rotina de gestão."],
                  ["Perdas", "Preço e prazo concentram os principais motivos demonstrativos."],
                ].map(([title, text]) => (
                  <div className="rounded-xl border border-slate-200 p-4" key={title}><strong className="text-sm text-slate-950">{title}</strong><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>
                ))}
              </div>
            </article>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
