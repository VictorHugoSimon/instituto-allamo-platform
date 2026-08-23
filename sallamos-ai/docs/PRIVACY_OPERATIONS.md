# Privacidade, retenção e operação — Sallamos AI

## Minimização
O texto original da pergunta é usado transitoriamente para retrieval e geração, mas a persistência em D1 passa por redaction. E-mail, CPF, CNPJ, telefone, cartões e tokens reconhecíveis são substituídos por marcadores. Feedback, escalonamentos e telemetria crítica usam a mesma sanitização.

## Retenção
- STAGE: mensagens/traces/respostas/feedback por 14 dias; eventos críticos por 30 dias.
- PRODUÇÃO: mensagens/traces/respostas/feedback por 90 dias; eventos críticos por 180 dias.
- Conversas com escalonamentos abertos são preservadas até resolução.
- `action_audit` não é removido por esta rotina; a futura fase AI Operator terá política própria de auditoria.

A limpeza roda no cron do Worker e também pode ser executada por `POST /api/ai/admin/retention` com `ADMIN_TOKEN`.

## Integrações externas
- Auth: timeout padrão de produção 1,5 s, uma repetição apenas para falhas transitórias 408/5xx.
- Contexto Sallamos: timeout padrão 1,8 s e uma repetição para falhas transitórias.
- Falha de autenticação externa fecha o acesso.
- Falha de contexto não autoriza inferência: o contexto é marcado como indisponível e o confidence gate decide clarificar/escalar.

## Status operacional
`GET /api/ai/admin/status` requer `ADMIN_TOKEN` e retorna somente metadados operacionais: fontes homologadas, embeddings pendentes, volume 24h, escalonamentos, feedback, snapshot recente e estado de configuração das integrações. Secrets nunca são retornados.

## Princípio LGPD
Coletar o mínimo necessário, restringir finalidade, limitar retenção, manter rastreabilidade e não usar dados de clientes como fonte de treinamento sem base legal e governança específica.
