# Status Report Államo — Template Mestre

## Objetivo
Todos os Status Reports publicados pelo Portal PMO devem usar o mesmo padrão visual do HTML de referência `status-report-dual-clima_202608.html`, variando somente os dados de cada projeto e de cada ciclo.

## Regras
- Cada Report pertence obrigatoriamente a uma empresa e, quando aplicável, a um projeto.
- Cada ciclo recorrente gera um novo `report_record` e uma nova `report_version`; o Report anterior nunca é sobrescrito.
- O ciclo deve manter vínculo com `previous_report_id` e `previous_cycle_id`.
- O cliente visualiza somente Reports `PUBLICADO` do próprio contexto Empresa → Projeto.
- O histórico é apresentado por ciclos/abas de Report.
- O layout visual é único: cabeçalho Államo, navegação interna, roadmap/escopo, semáforos, KPIs, Curva S/horas, riscos, RACI, documentação e próximos passos.
- Campos sem evidência não recebem números inventados. Exibir `A confirmar`/`Não informado` quando necessário.
- Novos campos e seções continuam suportados em `custom_sections`, sem quebrar o template mestre.

## Identificador do template
`allamo-status-report-master-v1`

## Evolução
Mudanças visuais futuras devem gerar uma nova versão de template sem alterar snapshots históricos já publicados.
