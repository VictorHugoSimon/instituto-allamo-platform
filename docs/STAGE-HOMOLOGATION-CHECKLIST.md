# Checklist final de homologação — Portal PMO Stage

> Ambiente: `https://allamo-pmo-stage.pages.dev`
>
> Regra de governança: **não promover para Produção enquanto houver item crítico reprovado.** Deploy não executa reset de banco e não deve apagar dados existentes.

## 1. Sessão e conectividade

- [ ] Login interno entra normalmente sem HTTP 503.
- [ ] Permanecer na página não provoca logout espontâneo.
- [ ] F5 mantém o usuário autenticado.
- [ ] Abrir 2 ou mais abas não provoca reload/logout em cascata.
- [ ] Trocar empresa, projeto e aba em uma janela não altera indevidamente o contexto da outra.
- [ ] Oscilação temporária de API/rede não remove `allamo_session`.
- [ ] Logout explícito encerra a sessão.

## 2. Cache e atualização de dados

- [ ] F5 não exibe carteira/demo antiga antes dos dados reais.
- [ ] Alteração salva em uma tela aparece após revalidação sem depender de limpar cookies/cache.
- [ ] APIs respondem com política `no-store`.
- [ ] Service Worker não serve resposta antiga de `/api/*` nem HTML antigo.
- [ ] Retorno à aba após alguns segundos revalida os dados sem bloquear a interface.

## 3. Multitenancy e contexto

- [ ] Usuário interno enxerga somente o contexto selecionado.
- [ ] Usuário cliente não acessa dados de outra empresa.
- [ ] Empresa com mais de um projeto lista todos os projetos autorizados.
- [ ] Cada projeto abre o próprio Status Report.
- [ ] Alterar Report de um projeto não altera Report de outro projeto da mesma empresa.

## 4. Link público do cliente

- [ ] `?cliente=<slug>` abre sem exigir login.
- [ ] Link da OPR não abre conteúdo de Esposende ou de outra empresa.
- [ ] Empresa inexistente apresenta erro controlado e não conteúdo de outro tenant.
- [ ] Empresa com vários projetos permite selecionar o projeto correto.
- [ ] Cabeçalho mostra empresa/projeto coerentes com o link.
- [ ] Botão de instalar aplicativo aparece quando aplicável.

## 5. Status Reports

- [ ] Lista de Reports carrega por empresa/projeto.
- [ ] Botões de lápis abrem edição diretamente no campo/seção correspondente.
- [ ] É possível criar seção/campo dinâmico.
- [ ] É possível ocultar/excluir campo permitido sem quebrar o Report.
- [ ] Campo criado permanece após F5 e novo login.
- [ ] Histórico cria nova versão ao salvar/alterar.
- [ ] Publicação mantém snapshot da versão publicada.
- [ ] Cliente vê somente campos marcados como visíveis.

## 6. Fases, marcos e evidências

- [ ] Fase/marco permite descrição/subscrição prevista pela interface.
- [ ] É possível anexar evidência/arquivo ao marco.
- [ ] Arquivo enviado pode ser aberto/baixado depois.
- [ ] Arquivo permanece disponível após F5.
- [ ] Exclusão autorizada remove somente o arquivo selecionado.
- [ ] Arquivos ficam vinculados ao tenant e ao projeto corretos.

## 7. Banco dinâmico

- [ ] Campos dinâmicos não dependem de alterar schema físico a cada novo campo de negócio.
- [ ] Criação/remoção lógica de campos preserva histórico e registros anteriores quando aplicável.
- [ ] Estruturas de tenant incluem `company_id` e, quando necessário, `project_id`.
- [ ] Deploy não executa `DELETE`, `DROP`, `TRUNCATE` ou reset de baseline.
- [ ] Dados criados antes do deploy continuam presentes depois do deploy.

## 8. Work Management

- [ ] Trabalho abre normalmente.
- [ ] Kanban, Backlog e Sprints carregam.
- [ ] Criar demanda/tarefa funciona.
- [ ] Editar, comentar e checklist persistem.
- [ ] Filtros respeitam empresa/projeto.

## 9. Copiloto PMO / IA

- [ ] Botão de IA aparece no editor de Status Report.
- [ ] `GET /api/report-ai/status` indica provider configurado no Stage.
- [ ] Geração por texto/reunião retorna proposta sem escrever automaticamente no Report.
- [ ] Alterações críticas exigem validação manual.
- [ ] Aplicar sugestão cria nova versão do Report.
- [ ] Falha do modelo não apaga nem altera o Report atual.

## 10. Responsividade e experiência

- [ ] Desktop não apresenta sobreposição de menus/modais.
- [ ] Navegação mobile funciona.
- [ ] Botões principais têm feedback de clique/carregamento.
- [ ] Erro de API apresenta mensagem controlada, não tela vazia infinita.
- [ ] Nenhuma tela fica presa indefinidamente em “Carregando dados do Portal PMO”.

## Critério de saída do Stage

Pronto para promoção somente quando:

1. todos os itens críticos de Sessão, Multitenancy, Link público, Reports e Persistência estiverem aprovados;
2. nenhuma perda de dados for observada;
3. os CIs de Session Stability, Data Freshness, Tenant Isolation, Data Persistence, Work Management, Report AI, Report Series, Responsive Usability, Build Idempotency e Post-Unpack estiverem verdes;
4. vulnerabilidades npm de alta severidade tiverem sido avaliadas de forma controlada antes da Produção;
5. backup do D1 de Produção for realizado imediatamente antes da promoção.
