# PMO — Cockpit Executivo 2.0

## Escopo
Esta evolução é exclusiva do Painel de PMO do Instituto Államo.

Não faz parte deste pacote qualquer alteração em Valkíria, WhatsApp, Sallamos AI, CRM comercial, site institucional ou módulos externos ao PMO.

## Objetivo
Transformar a Visão Geral do PMO em um cockpit executivo único, orientado a decisão, usando apenas dados reais já persistidos ou explicitamente identificados como indisponíveis.

## Blocos funcionais

### 1. Portfólio
- empresas ativas;
- projetos ativos;
- projetos em andamento;
- projetos em risco;
- projetos atrasados;
- backlog;
- projetos concluídos.

### 2. Saúde
- verde;
- amarelo;
- vermelho;
- sem atualização recente.

### 3. Execução
- planejado x realizado;
- Curva S consolidada;
- marcos próximos;
- entregas atrasadas.

### 4. Gestão
- riscos críticos;
- impedimentos;
- decisões pendentes;
- dependências externas;
- ações vencidas.

### 5. Capacidade
- horas planejadas;
- horas realizadas;
- consumo por projeto;
- utilização por profissional;
- proteção contra dupla contagem na visão global.

### 6. Governança
- último Status Report por projeto;
- projetos sem report atualizado;
- DoR/DoD;
- próximos ritos e checkpoints.

### 7. Adoção
Preparar o painel para futura telemetria de uso, sem criar métricas fictícias enquanto os eventos ainda não estiverem integrados.

## Fontes oficiais
- Cloudflare D1 do ambiente corrente;
- empresas e projetos persistidos;
- project_reports / project_reports_p;
- Work Management;
- Curva S / FCH;
- riscos e RACI;
- Governança de Sprint DoR/DoD.

## Princípios
1. Nenhum KPI pode ser inventado.
2. Ausência de dado deve ser exibida como `Não disponível` ou `Sem atualização`.
3. Todo indicador deve possuir origem rastreável.
4. O cockpit deve permitir drill-down quando houver tela operacional correspondente.
5. Alterações de schema, se necessárias, devem ser aditivas.
6. Nenhuma limpeza destrutiva faz parte deste pacote.
7. STAGE deve ser homologado antes de qualquer promoção para Produção.

## Critérios de aceite
- KPIs derivados exclusivamente de fontes reais.
- Estados sem informação claramente diferenciados de zero real.
- Sem dupla contagem de horas consolidadas.
- Sem quebra de isolamento por empresa/projeto.
- Layout responsivo desktop/mobile.
- Regressão das telas PMO existentes aprovada.
- Release STAGE verde antes de promoção.
