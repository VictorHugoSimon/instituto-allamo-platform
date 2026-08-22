# Sallamos AI — Runtime Evidence

## Objetivo
A Valkíria aprende com comportamento real do Sallamos sem depender de POP em Drive. O fluxo oficial é:

`Sallamos/STAGE → ingestão server-to-server → sanitização → rascunho tenant-scoped → revisão humana → homologação → embedding → retrieval`.

## Regra de isolamento
Toda evidência recebida pelo endpoint nasce com `scope=tenant`. Ela só pode ser recuperada pelo mesmo tenant que originou a evidência. Conteúdo tenant-scoped não aparece no dashboard nem no retrieval de outros tenants.

Para promover conhecimento de `tenant` para `global`, o homologador deve informar `publishScope=global` e `globalizationEvidence` explícita. Uma ocorrência isolada nunca é generalizada automaticamente.

## Idempotência
Enviar `eventId` no corpo ou `X-Idempotency-Key`. O par `tenantId + eventId` é único. Retries do mesmo evento retornam `status=duplicate` e não criam novo documento.

## SDK server-side
Use `sdk/runtime-evidence-client.mjs` em backend/worker/serviço interno. O SDK sanitiza campos sensíveis antes do envio, aplica timeout, retries exponenciais e idempotency key.

```js
import { createRuntimeEvidenceClient } from './runtime-evidence-client.mjs';
const evidence = createRuntimeEvidenceClient({
  baseUrl: process.env.SALLAMOS_AI_URL,
  token: process.env.EVIDENCE_INGEST_TOKEN,
  tenantId: tenant.id,
  owner: 'Suporte Sallamos',
  version: appVersion
});
await evidence.emit({
  module: 'financeiro',
  kind: 'successful_flow',
  summary: 'Conciliação OFX concluída após parametrização validada.',
  payload: { route: '/financeiro/conciliacao', result: 'success' }
});
```

**Nunca coloque `EVIDENCE_INGEST_TOKEN` em JavaScript de navegador, PWA ou aplicativo distribuído.** A chamada deve sair de backend confiável.

## Homologação
O endpoint de runtime evidence não ativa conhecimento. O documento permanece `rascunho`. Um administrador revisa a evidência e decide rejeitar, homologar apenas para aquele tenant ou, com justificativa adicional, publicar como global.

## Contrato
Contrato OpenAPI: `docs/runtime-evidence.openapi.yaml`.
