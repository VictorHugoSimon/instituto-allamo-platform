# Runtime Evidence — conhecimento sem dependência de POP

## Objetivo
Permitir que a Valkíria aprenda com evidências reais do Sallamos sem depender de POPs em Drive ou de código privado indisponível.

## Fluxo
`Sallamos/STAGE → POST /api/ai/evidence/runtime → sanitização → rascunho → revisão humana → homologado → reindex → retrieval`.

Nada recebido por esse endpoint vira conhecimento ativo automaticamente.

## Autenticação
Usar `Authorization: Bearer <EVIDENCE_INGEST_TOKEN>`.
O token é exclusivo da integração de evidências e não deve reutilizar `ADMIN_TOKEN`, token de usuário ou token da API Sallamos.

A esteira lê `EVIDENCE_INGEST_TOKEN` do GitHub Environment e o provisionador sincroniza o valor para o Worker via `wrangler secret put`. Se já houver secret no Worker e nenhum valor novo for fornecido no STAGE, ele é preservado; em produção o preflight exige valor explícito no Environment.

## Tipos aceitos
- `api_exchange`
- `error`
- `successful_flow`
- `support_resolution`
- `telemetry`
- `integration`
- `permission_behavior`

## Payload mínimo
```json
{
  "kind": "error",
  "module": "financeiro",
  "version": "2026.08",
  "owner": "time-sallamos",
  "title": "Erro validado na importação OFX",
  "summary": "Descrição objetiva do comportamento observado",
  "observedAt": "2026-08-22T12:00:00Z",
  "sourceUri": "runtime:stage",
  "payload": {
    "httpStatus": 422,
    "route": "/exemplo",
    "errorCode": "EXEMPLO"
  }
}
```

## Privacidade
O payload passa por sanitização recursiva. Campos como senha, token, authorization, cookie, CPF, CNPJ, e-mail, telefone, conta bancária, cartão e API key são removidos/redigidos antes do armazenamento. Mesmo assim, o produtor deve enviar o mínimo necessário.

## Regra de homologação
Uma evidência isolada descreve apenas o que foi observado. O homologador deve confirmar se ela representa uma regra geral, um comportamento da versão informada ou apenas uma ocorrência específica. Somente depois deve aprovar o documento.

## Uso recomendado
1. Capturar erros reais e suas resoluções confirmadas.
2. Capturar fluxos executados com sucesso no STAGE.
3. Capturar contratos reais de request/response de APIs.
4. Capturar permissões observadas por perfil.
5. Capturar feedback resolvido do suporte.
6. Rejeitar evidência ambígua, específica de cliente ou sem contexto suficiente.

## Segurança operacional
- Produção exige `EVIDENCE_INGEST_TOKEN` no preflight e no readiness.
- Sem token, o endpoint falha fechado.
- O smoke test verifica que chamadas sem token retornam 401/503.
- Evidência continua em status `rascunho` até aprovação administrativa explícita.
