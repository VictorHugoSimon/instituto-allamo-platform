# Contrato de Integração — Sallamos ↔ Valkíria AI

Este documento define o contrato mínimo necessário para operar o Sallamos AI em produção sem acesso direto e irrestrito ao banco transacional.

## 1. Princípios
- A Valkíria inicia em modo read-only.
- Toda requisição é vinculada a `tenantId` e `userId` validados pelo Sallamos.
- Credenciais de serviço usam menor privilégio.
- CPF, CNPJ, e-mail, telefone, senha, token, chaves e dados bancários não devem ser retornados nos endpoints de contexto.
- O Sallamos continua sendo a fonte de verdade de identidade, permissão, tenant e configuração operacional.

## 2. Validação de sessão
A variável `SALLAMOS_AUTH_VALIDATE_URL` aponta para um endpoint HTTPS do Sallamos.

### Request
`POST {SALLAMOS_AUTH_VALIDATE_URL}`

Headers:
- `Authorization: Bearer <sessão-do-usuário>`
- `Content-Type: application/json`
- opcional `x-sallamos-ai-token: <credencial-serviço>`

Body:
```json
{"audience":"sallamos-ai-support"}
```

### Response 200
```json
{
  "valid": true,
  "userId": "usr_123",
  "tenantId": "tenant_456",
  "profile": "financeiro:editor",
  "permissions": ["ai:support:query","ai:feedback:create","ai:escalation:create","ai:dashboard:read"],
  "productVersion": "4.2.0",
  "locale": "pt-BR"
}
```

### Erros
- `401/403`: sessão inválida/sem autorização.
- `5xx`: indisponibilidade do provedor de autenticação; a Valkíria falha fechada.

## 3. Contexto read-only
`SALLAMOS_API_BASE` aponta para a API interna Sallamos.

A Valkíria chama:
- `POST {SALLAMOS_API_BASE}/ai/context/tenant_config`
- `POST {SALLAMOS_API_BASE}/ai/context/user_permissions`
- `POST {SALLAMOS_API_BASE}/ai/context/feature_flags`

Headers:
- `Content-Type: application/json`
- `x-internal-caller: sallamos-ai`
- opcional `Authorization: Bearer <SALLAMOS_API_TOKEN>`

Body:
```json
{"tenantId":"tenant_456","userId":"usr_123","productVersion":"4.2.0"}
```

### tenant_config — exemplo mínimo
```json
{
  "available": true,
  "module": "financeiro",
  "version": "4.2.0",
  "profile": "financeiro:editor"
}
```

### user_permissions — exemplo mínimo
```json
{"available":true,"permissions":["financeiro:read","ai:support:query"]}
```

### feature_flags — exemplo mínimo
```json
{"available":true,"features":{"debito_automatico":true,"dre_v42":true}}
```

## 4. SLA recomendado entre serviços
- Timeout alvo por endpoint de contexto: até 2 s.
- Falha de contexto não autoriza palpite: reduz confiança ou escala.
- Endpoints devem ser idempotentes e sem efeitos colaterais.

## 5. Fonte real de conhecimento
Produção exige pelo menos uma fonte `homologado` contendo documentação, release ou código real. Cada fonte deve possuir:
- owner;
- status;
- módulo;
- versão/commit;
- URI de origem;
- hash de conteúdo;
- data de atualização.

A credencial de repositório, quando necessária, deve ser exclusivamente read-only.

## 6. Critérios de aceite da integração
1. Sessão válida retorna tenant, usuário, perfil, permissões e versão.
2. Sessão de tenant A nunca permite consultar tenant B.
3. Context endpoints não retornam PII bloqueada.
4. Indisponibilidade de auth gera falha fechada.
5. Indisponibilidade de contexto não gera resposta inventada.
6. `/health/ready` fica `true` em produção somente com autenticação e conhecimento homologado disponíveis.
