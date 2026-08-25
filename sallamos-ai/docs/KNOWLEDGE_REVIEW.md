# Sallamos AI — Fila de homologação de conhecimento

## Objetivo
Dar ao responsável funcional uma rotina auditável para revisar evidências e documentos antes de eles influenciarem respostas da Valkíria.

A regra continua sendo:
`evidência → sanitização → rascunho → revisão → homologação/rejeição → reindex → retrieval`.

## Segurança
As rotas deste documento exigem `Authorization: Bearer <ADMIN_TOKEN>` e devem ser chamadas somente por backoffice confiável. O conteúdo retornado é o conteúdo sanitizado já persistido no D1; a API de revisão não busca arquivo bruto externo e não aprova nada automaticamente.

## 1. Listar fila
`GET /api/ai/admin/knowledge/review`

Parâmetros opcionais:
- `status`: `rascunho` (padrão), `rejeitado`, `homologado` ou `indexado`;
- `scope`: `tenant` ou `global`;
- `tenantId`;
- `module`;
- `sourceType`: `doc`, `code`, `release`, `faq`, `history` ou `tool`;
- `limit`: 1–100, padrão 25;
- `before` e `beforeId`: cursor devolvido pela página anterior.

A resposta traz metadados, quantidade de chunks, progresso de embedding e, quando a origem é runtime evidence, `eventId`, tipo e data de recebimento.

## 2. Abrir item
`GET /api/ai/admin/knowledge/{documentId}`

Retorna:
- metadados e escopo;
- identificação do runtime event quando existir;
- chunks sanitizados na ordem original;
- trilha das últimas ações de auditoria;
- ações atualmente permitidas.

## 3. Aprovar
`POST /api/ai/admin/knowledge/{documentId}/approve`

Exemplo tenant-scoped:
```json
{
  "approvedBy": "responsavel-funcional",
  "approvalEvidence": "Fluxo reproduzido e validado no STAGE em versão vigente.",
  "publishScope": "tenant"
}
```

Para transformar uma evidência que nasceu em um tenant em regra global, também é obrigatório informar `globalizationEvidence` com justificativa verificável. Uma ocorrência isolada de cliente não deve ser generalizada.

## 4. Rejeitar
`POST /api/ai/admin/knowledge/{documentId}/reject`

```json
{
  "rejectedBy": "responsavel-funcional",
  "reason": "Comportamento específico de configuração do cliente; não representa regra confiável."
}
```

## 5. Reindexar
Depois da homologação, executar `POST /api/ai/admin/reindex` ou aguardar o cron de embeddings. Apenas documentos `homologado` entram no Vectorize.

## Critério operacional recomendado
A fila de `rascunho` deve ser revisada continuamente. Priorizar: incidentes resolvidos, fluxos bem-sucedidos, erros recorrentes e mudanças de versão. Itens sem owner, sem versão ou sem evidência reproduzível devem ser rejeitados ou mantidos fora da base ativa.
