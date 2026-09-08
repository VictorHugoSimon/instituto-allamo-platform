# ADR — Onboarding PMO com sessão humana e idempotência persistida

- **Status:** Homologado em STAGE; candidato à Produção
- **Data:** 2026-09-08
- **Escopo:** Painel Operacional PMO do Instituto Államo
- **Relacionado:** Issue #263

## Contexto

Os hosts oficiais do Painel PMO permitem consultas sem tela de login por meio de uma identidade PMO sintética (`__portal_no_login`). Esse modelo é adequado para a operação de leitura do portal, mas não fornece atribuição humana suficiente para criar empresas e projetos reais.

O hardening existente já impede exclusões destrutivas pela identidade sintética, valida duplicidade de empresa, exige empresa válida para projeto, preserva RBAC e registra auditoria. Restavam duas decisões do épico #263:

1. como impedir duplicação quando a mesma solicitação de onboarding é reenviada;
2. se criação real de empresa/projeto pode usar a identidade sintética do portal.

## Decisão

### 1. Sessão humana obrigatória para onboarding

Criação de empresa e projeto exige uma sessão autenticada real.

- A identidade sintética `__portal_no_login` continua válida para leitura do Painel.
- POST de onboarding com identidade sintética retorna `403` e código `authenticated_onboarding_required`.
- Bearer token válido continua tendo prioridade sobre o modo sem login, conforme o contrato de autenticação já existente.
- RBAC existente permanece: empresa = `admin|pmo`; projeto = `admin|pmo|gestor`, respeitando o escopo da empresa para gestor.

### 2. `request_id` / `Idempotency-Key` obrigatório

Toda criação de empresa ou projeto deve informar uma chave idempotente explícita, via header `Idempotency-Key` ou campo `request_id`.

Contrato:

- 8 a 120 caracteres;
- caracteres permitidos: letras, números, `.`, `_`, `:`, `-`;
- a chave é persistida no D1 antes do INSERT de negócio;
- o payload é normalizado por ordenação das chaves de primeiro nível, excluindo `request_id`, e armazenado como SHA-256.

### 3. Ledger persistente

Tabela aditiva `onboarding_requests`:

- `request_id` como chave primária;
- tipo de entidade (`company`/`project`);
- hash do payload;
- estado `pending` ou `completed`;
- ID da entidade criada;
- empresa relacionada quando aplicável;
- ator autenticado;
- timestamps.

Comportamento:

- mesma chave + mesmo payload + concluído → retorna o mesmo recurso com `replayed=true` e não duplica;
- mesma chave + payload/tipo diferente → `409 idempotency_conflict`;
- mesma chave ainda `pending` → `409 request_in_progress` e nenhuma nova tentativa de INSERT é feita;
- uma reserva `pending` após falha inesperada é tratada como estado de reconciliação manual, não como autorização para repetir cegamente a mutação.

## Trade-offs

### Benefícios

- evita duplicidade por retry do cliente, refresh ou timeout;
- permite rastrear quem iniciou cada onboarding;
- separa consulta sem login de mutação administrativa sensível;
- fail-closed em concorrência e estado incerto;
- não exige seed, tenant fictício ou alteração destrutiva.

### Custos / limitações

- o cadastro real deixa de funcionar pela identidade sintética sem uma sessão humana válida;
- o cliente/UX responsável pelo onboarding deve manter a mesma chave durante retries da mesma tentativa;
- entradas `pending` decorrentes de falha após a reserva precisam de reconciliação operacional explícita; não haverá retry automático destrutivo;
- o wizard operacional de onboarding permanece uma evolução separada; esta ADR define primeiro o contrato seguro da API.

## Segurança e LGPD

O ledger guarda somente metadados operacionais mínimos e o hash do payload, não uma cópia integral do cadastro. A auditoria já existente continua sendo a trilha funcional da criação.

## Implantação

1. PR para `develop`.
2. CI completa.
3. Backup D1 STAGE.
4. Migration aditiva `onboarding_requests`.
5. Deploy STAGE.
6. Smoke autenticado controlado, com empresa/projeto temporários, replay, conflito e cleanup rastreável.
7. Homologação STAGE concluída no run `34226736344`, preservando integralmente o baseline preexistente.
8. Promoção cirúrgica para `main` com backup obrigatório de Produção antes do schema e do deploy.

## Fora do escopo

- criação automática de empresa/projeto;
- seed de tenants;
- merge integral de `develop` em `main`;
- alteração de Valkíria, WhatsApp, Sallamos AI, Semeali ou módulos comerciais;
- criação da primeira empresa real sem demanda explicitamente aprovada.
