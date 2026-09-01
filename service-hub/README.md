# Valkíria Service Hub

Módulo omnichannel do Instituto Államo para centralizar atendimento, contexto de implantação, chamados e roteamento entre Sallamos e Államo Service Desk.

## Princípios

1. `tenant_id` e `project_id` vêm da plataforma Államo; o Service Hub não duplica o cadastro mestre.
2. Toda mensagem pertence a tenant + projeto + canal.
3. Nenhuma mensagem vira chamado sem classificação/roteamento.
4. Dúvida pode ser respondida pela Valkíria; incidente/solicitação/bloqueio segue a regra do sistema e da fase.
5. Sallamos em produção mantém Sallamos como origem oficial do chamado.
6. Sistemas externos em sustentação usam Államo Service Desk.
7. Mensagens e descrições persistidas devem ser sanitizadas antes do armazenamento.
8. Todo ticket possui trilha de eventos e auditoria.
9. `tenantId` vem exclusivamente do contexto autenticado; payload nunca escolhe tenant.

## Roteamento MVP

| Sistema | Fase | Mensagem | Destino |
|---|---|---|---|
| qualquer | qualquer | question | Valkíria |
| qualquer | qualquer | social/context/report | contexto apenas |
| Sallamos | production | incident/request/change/blocker | Sallamos |
| Sallamos | implementation/hypercare | incident/request/change/blocker | fila do projeto |
| externo/interno | support | incident/request/change/blocker | Államo Service Desk |
| externo/interno | implementation/hypercare | incident/request/change/blocker | fila do projeto |
| qualquer | closed/sem regra | acionável | revisão humana |

## Entidades iniciais

- `service_hub_systems`
- `service_hub_channels`
- `service_hub_sla_policies`
- `service_hub_routing_rules`
- `service_hub_tickets`
- `service_hub_ticket_events`
- `service_hub_messages`
- `service_hub_audit_log`

## API modular

A função `handleServiceHubApi(request, env, context)` foi desenhada para ser conectada ao worker principal da plataforma. O adapter de autenticação deve fornecer:

```js
{
  tenantId: 'tenant-id-da-sessao',
  actorType: 'user',
  actorRef: 'user-id',
  permissions: ['service_hub:read','service_hub:write']
}
```

Permissões do módulo:

- `service_hub:read`
- `service_hub:write`
- `service_hub:configure`
- `service_hub:*`

Rotas atuais:

| Método | Rota | Permissão | Uso |
|---|---|---|---|
| GET | `/api/service-hub/health` | read | saúde lógica do módulo |
| GET | `/api/service-hub/systems` | read | listar sistemas do tenant |
| POST | `/api/service-hub/systems` | configure | cadastrar sistema/projeto |
| GET | `/api/service-hub/channels` | read | listar canais/grupos |
| POST | `/api/service-hub/channels` | configure | cadastrar canal/grupo |
| GET | `/api/service-hub/sla-policies` | read | listar políticas de SLA |
| POST | `/api/service-hub/sla-policies` | configure | cadastrar SLA corrido |
| GET | `/api/service-hub/tickets` | read | listar chamados |
| POST | `/api/service-hub/tickets` | write | abrir chamado |
| GET | `/api/service-hub/tickets/:id` | read | detalhe do chamado |
| GET | `/api/service-hub/tickets/:id/events` | read | histórico/auditoria operacional |
| POST | `/api/service-hub/tickets/:id/status` | write | alterar status/responsável |

## SLA no MVP

O MVP calcula SLA em minutos corridos. Políticas marcadas como `businessHoursOnly=true` ficam bloqueadas até existir uma definição formal de calendário, timezone, fins de semana e feriados. Isso evita publicar prazos incorretos.

## Privacidade

Descrições e notas passam por sanitização antes de persistir. O módulo remove ou mascara e-mail, CPF, CNPJ, telefone, cartão e secrets/tokens reconhecíveis. Dados de integração brutos não devem ser salvos no Service Desk sem necessidade operacional.

## Próximos incrementos

1. conectar a API modular ao worker/autenticação da plataforma;
2. classificador de mensagens;
3. adaptador oficial do WhatsApp;
4. integração Sallamos;
5. Kanban, reports, follow-up e dashboards;
6. integração com Runtime Evidence da Valkíria.

## Validação

```bash
cd service-hub
npm test
```

O workflow `Valkiria Service Hub CI` também executa syntax check, testes unitários e validação do schema D1 em SQLite.
