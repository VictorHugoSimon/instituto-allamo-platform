# Semeali White-Label Sales Intelligence — V1

## Objetivo

Entregar a Semeali como primeiro tenant comercial white-label da plataforma Államo, preservando isolamento multiempresa, identidade própria, governança de acesso, trilha de auditoria e evolução modular.

## Decisão arquitetural canônica

A plataforma atualmente publicada e homologada pela Államo usa:

`GitHub → build:work → public/ → Cloudflare Pages/Worker → Cloudflare D1`

O isolamento do core vivo é feito por `company_id`.

A implementação em `apps/web` (Next.js + Supabase) continua na branch como trilha de evolução e referência de produto, mas **não é o runtime canônico do Stage atual**. A Semeali operacional foi, portanto, integrada também ao core D1 existente, evitando dois bancos ou dois sistemas concorrentes em homologação.

## Princípios

1. A Államo administra a plataforma; cada cliente opera apenas dentro do seu tenant.
2. Dados comerciais usam `company_id` em todas as entidades do D1.
3. APIs validam o `scope` da sessão antes de consultar ou gravar dados do tenant.
4. Triggers D1 bloqueiam referências cruzadas entre empresas mesmo fora da API principal.
5. Convites de acesso armazenam somente o hash do token.
6. A senha inicial é definida pelo próprio convidado; administradores não compartilham nem conhecem a senha.
7. Deploy e migrations são aditivos; o Stage não é resetado para receber a Semeali.
8. Regras críticas de aprovação permanecem separadas da execução em campo.
9. Dados demonstrativos só são usados onde estiverem explicitamente identificados.
10. Conceitos dos sistemas de referência podem ser reaproveitados, mas não nomes, identidade visual ou marca de terceiros.

## Tenant Semeali

Identificador canônico de Stage: `semeali`

Nome: `Semeali`

Produto: `Államo Sales Intelligence`

Provisionamento:

- script `scripts/ensure-semeali-tenant.mjs`;
- funciona somente com `wrangler.stage.toml`;
- exige confirmação `ENSURE-SEMEALI-STAGE` para aplicar;
- é idempotente;
- não cria usuário, senha ou credencial;
- não está ligado ao deploy de produção.

## Domínio comercial D1

Migration principal:

`migrations/2026-09-03-commercial-sales-intelligence.sql`

Entidades implementadas:

- `commercial_accounts` — carteira, prospects, produtores, revendas, cooperativas e clientes;
- `commercial_opportunities` — pipeline, cultura, potencial, hectares, score, probabilidade e estágio;
- `commercial_interactions` — contatos, reuniões, visitas e evidências de campo;
- `commercial_routes` — agenda/roteiro por responsável e data;
- `commercial_route_stops` — contas e sequência de paradas da rota;
- `commercial_campaigns` — campanhas, regiões, culturas e audiência;
- `commercial_approvals` — desconto, crédito, exceções de preço e condições comerciais.

Todas as tabelas possuem `company_id` e índices orientados ao tenant.

## Isolamento adicional no D1

Migration:

`migrations/2026-09-03-commercial-tenant-guards.sql`

Triggers impedem:

- oportunidade apontar para conta de outra empresa;
- visita/interação apontar para conta ou oportunidade de outro tenant;
- parada de rota usar rota ou conta de outra empresa;
- aprovação comercial usar conta ou oportunidade de outro tenant.

A API também valida essas relações antes da gravação.

## Segurança da criação de rotas

A criação da rota possui um guard específico em:

`src/commercial-sales-intelligence-route-guard.js`

O fluxo é:

1. validar sessão e perfil;
2. validar `company_id` contra o `scope` autenticado;
3. carregar todas as contas solicitadas;
4. confirmar que todas pertencem ao mesmo tenant;
5. somente depois inserir a rota;
6. inserir as paradas já validadas.

Isso evita rota parcial causada por uma conta incompatível no meio da lista.

## Papéis no core D1

### Admin / PMO

- visão multiempresa;
- gestão de tenant;
- gestão comercial;
- aprovação;
- compartilhamento de acesso.

### Gestor do cliente

- restrito ao próprio `company_id`;
- gestão comercial do tenant;
- execução de campo;
- aprovação conforme regra atual;
- pode convidar apenas perfil `usuario` para o próprio tenant.

### Usuário do cliente

- restrito ao próprio `company_id`;
- leitura comercial;
- registro de visita/interação;
- criação de rota própria;
- solicitação de aprovação;
- não recebe poder de gestão da carteira;
- não recebe poder de decisão/aprovação.

## Compartilhamento seguro de acesso

Migration:

`migrations/2026-09-03-access-invitations.sql`

APIs:

- `src/access-invitation-api.js` — criação, listagem e cancelamento autenticados;
- `src/access-invitation-public-api.js` — consulta e aceite público pelo token.

Interface:

`src/access-invitation-ui.js`

Fluxo:

1. Admin/PMO/Gestor abre **Compartilhar acesso**.
2. Seleciona empresa, e-mail, perfil e validade.
3. Backend gera token aleatório.
4. Apenas `token_hash` é salvo no D1.
5. O link bruto é devolvido uma única vez e pode ser enviado por e-mail/copied.
6. O convidado abre `?convite=...`.
7. O backend valida token, status e expiração.
8. O convidado informa nome e define a própria senha.
9. O usuário é criado com o `company_id` e o papel gravados no convite.
10. O convite passa para `ACCEPTED`.
11. O convidado usa o login normal.

Se o e-mail já estiver vinculado a outro tenant, o aceite é bloqueado.

## Status real do envio do convite

A função de e-mail da plataforma sempre registra o envio no `email_outbox`. O endpoint de convites consulta o status real do outbox e devolve:

- `enviado`;
- `pendente`;
- `falhou`;
- ou estado desconhecido.

A interface não afirma que o e-mail foi enviado quando isso não foi confirmado. O link permanece disponível para cópia manual.

## Interface canônica Semeali

Arquivo:

`src/commercial-sales-intelligence-ui.js`

A experiência é injetada no `public/index.html` pelo hardener e aparece apenas quando a sessão consegue localizar o tenant Semeali.

Abas implementadas na primeira versão operacional:

- Visão geral;
- Oportunidades;
- Carteira & CRM;
- Aprovações;
- Rotas.

A interface usa dados reais do D1 e permite:

- cadastrar conta;
- criar oportunidade;
- criar rota;
- listar pipeline;
- listar carteira;
- aprovar/rejeitar solicitações quando o perfil possuir alçada;
- visualizar indicadores de pipeline, hectares, visitas e aprovações.

A API já possui suporte para interações/visitas; a experiência dedicada de relatório de visita é uma das próximas evoluções de UI.

## Build canônico

Hardener:

`scripts/harden-commercial-sales-intelligence.mjs`

Ele injeta, de forma idempotente:

- API pública de aceite do convite antes do login;
- API autenticada de convites depois da autenticação;
- API comercial e guard de rotas depois da autenticação;
- UI Sales Intelligence no `public/index.html`;
- UI de compartilhamento/aceite de acesso no `public/index.html`.

O hardener é chamado pela cadeia existente de `npm run build:work`; não foi criada uma segunda pipeline de artefato.

## Gate aditivo do D1

`scripts/ensure-additive-schema.mjs` agora reconhece:

- as 7 tabelas comerciais;
- a tabela `access_invitations`;
- a migration comercial;
- os triggers anti-cross-tenant;
- a migration de convites.

O fluxo do Stage continua:

1. backup obrigatório do D1;
2. dry-run do schema;
3. aplicação somente aditiva;
4. reparo idempotente de tenants existentes;
5. provisionamento idempotente da Semeali em Stage;
6. build/testes;
7. publicação do mesmo artefato validado;
8. smoke tests.

## CI específico da Semeali

Workflow:

`.github/workflows/semeali-commercial-domain-ci.yml`

Valida:

- build canônico `build:work`;
- contrato Next/Supabase mantido na branch;
- contrato do domínio comercial D1;
- presença de `company_id`;
- ausência de operações destrutivas nas migrations da Semeali;
- triggers anti-cross-tenant;
- pré-validação de rota;
- injeção de API/UI no Worker/HTML finais;
- convite por hash;
- aceite com tenant fixo;
- provisionamento Semeali somente em Stage.

## O que ainda falta depois da homologação técnica

1. relatório de visita dedicado na UI, com fotos/anexos;
2. georreferenciamento/mapa real de território;
3. importação autorizada de carteira e oportunidades reais da Semeali;
4. regras configuráveis de alçada por percentual/valor;
5. integração com ERP para pedido, preço, estoque, faturamento e entrega;
6. campanhas operacionais completas e confirmação de leitura;
7. telemetria de adoção por perfil;
8. agentes de IA conectados apenas a fontes homologadas;
9. definição da estratégia de produção do tenant Semeali após homologação de Stage.

## Regra de produção

Nenhuma criação automática do tenant Semeali em produção foi adicionada.

A promoção para produção deve ocorrer somente depois de:

- CI verde;
- homologação funcional no Stage canônico;
- teste do convite real;
- teste de isolamento entre Semeali e outro tenant;
- backup/rollback validado;
- aprovação explícita da promoção.
