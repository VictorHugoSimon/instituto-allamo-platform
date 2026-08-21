const summaryCards = [
  {
    label: "Projetos ativos",
    value: "0",
    description: "Nenhum projeto cadastrado",
  },
  {
    label: "Contatos",
    value: "0",
    description: "Base de relacionamento vazia",
  },
  {
    label: "Pendências",
    value: "0",
    description: "Nenhuma pendência crítica",
  },
  {
    label: "Documentos",
    value: "0",
    description: "Nenhum documento recente",
  },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
              Visão geral
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Bem-vindo à plataforma
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Acompanhe os principais indicadores da organização e acesse os
              módulos operacionais em um único ambiente.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              type="button"
            >
              Exportar visão
            </button>

            <button
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              type="button"
            >
              Novo projeto
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            key={card.label}
          >
            <p className="text-sm font-semibold text-slate-500">{card.label}</p>
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
              {card.value}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {card.description}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-bold text-slate-950">
              Atividades recentes
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Atualizações mais recentes da organização.
            </p>
          </header>

          <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-lg font-bold text-slate-500">
              A
            </div>

            <h3 className="mt-4 font-bold text-slate-950">
              Nenhuma atividade registrada
            </h3>

            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              As movimentações de projetos, usuários e documentos aparecerão
              neste espaço.
            </p>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-bold text-slate-950">
              Próximos compromissos
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Agenda resumida da organização.
            </p>
          </header>

          <div className="space-y-3 p-6">
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
              <p className="text-sm font-semibold text-slate-700">
                Agenda ainda não configurada
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Reuniões, eventos e prazos serão exibidos aqui.
              </p>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}