# Correção de interação de edição do Status Report

## Sintoma
- Botão `✎ Editar report` não abre o editor em alguns pontos do Status Report.
- Ícones de lápis de seções podem não responder.
- O comportamento ocorre em Stage e Produção porque está no runtime compartilhado do front-end.

## Causas
1. `report-contextual-editor.js` capturava cliques em modo capture e podia chamar `stopImmediatePropagation()` antes do handler nativo do Portal.
2. `openReportEditor()` usava `this.reports[cid]`, embora Reports por projeto sejam armazenados por `this.repKey()` (`p:<project_id>`).

## Regra corrigida
- Controles nativos do Portal (`✎ Editar report`, lápis de seção e `✎ Editar tarefas/fases`) permanecem sob responsabilidade do handler nativo do componente.
- O editor contextual continua disponível por API (`window.AllamoContextualReportEditor.open(section)`), mas não sequestra cliques nativos.
- `openReportEditor()` sempre lê o rascunho pela chave retornada por `repKey()`.
- `submitReport()` continua salvando pelo `repQuery()`, preservando isolamento empresa/projeto.

## Critérios de aceite
- Botão principal abre o modal de edição.
- Lápis abre o modal e posiciona a seção correspondente.
- Edição de Report de um projeto carrega os dados do projeto, não o Report da empresa.
- Salvar persiste no mesmo projeto selecionado.
- Nenhuma rotina de reset/delete é adicionada.
