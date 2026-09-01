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

## Próximos incrementos

1. API CRUD de sistemas/canais/SLA.
2. criação e atualização de tickets;
3. classificador de mensagens;
4. adaptador oficial do WhatsApp;
5. integração Sallamos;
6. reports, follow-up e dashboards;
7. integração com Runtime Evidence da Valkíria.

## Validação

```bash
cd service-hub
npm test
```
