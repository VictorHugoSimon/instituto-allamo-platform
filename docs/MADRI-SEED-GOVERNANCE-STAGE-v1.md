# MADRI — Seed Governança STAGE v1

Data: 08/09/2026

## Objetivo
Materializar no D1 de **STAGE** a base de rastreabilidade já levantada para a implantação MADRI × NUCCI, sem alterar Produção e sem sobrescrever registros existentes.

## Fontes
- `Matriz_Auditoria_RFI_x_Blueprint_MADRI_v1.xlsx`
- Plano Mestre de Testes MADRI v0.1, baseline histórico recuperado antes da migração para D1
- Business Blueprint MADRI v1.0 como documento-alvo de rastreabilidade

## Conteúdo do pacote
- 71 requisitos reconstruídos da RFI
- 15 requisitos novos pós-RFI / workshops
- 54 casos de teste históricos (`TST-001` a `TST-054`)
- 15 fases de implantação
- 17 itens de readiness

Cobertura dos 71 requisitos reconstruídos:
- 26 `Coberto`
- 25 `Coberto parcialmente`
- 15 `Gap`
- 5 `Não localizado`

Os 15 requisitos adicionais entram como `Novo requisito`.

## Regras de governança
- Seed exclusivo de STAGE.
- `INSERT OR IGNORE`: registros existentes e edições humanas não são sobrescritos.
- Não inferir `STD / CFG / DEV / INT` sem evidência formal; a classificação permanece vazia.
- `NEW-002` é marcado eliminatório porque a fonte o qualifica explicitamente como requisito não funcional/eliminatório.
- Demais requisitos não recebem marca eliminatória por inferência.
- Testes entram como `Planejado`, `expected_met=0` e `Sem evidência suficiente`.
- O seed não cria defeitos, decisões ou integrações sem evidência específica.
- Sequências de Testes/Fases/Readiness são avançadas para evitar colisão com IDs importados.
- Antes da aplicação, o workflow cria backup do D1 STAGE e guarda o artefato por 14 dias.

## Validação esperada
Após a carga, o script exige:
- 86 IDs do pacote presentes em `madri_requirements`;
- 54 IDs do pacote presentes em `madri_tests`;
- 15 fases;
- 17 itens de readiness;
- sequências mínimas `tests=55`, `phases=16`, `readiness=18`;
- API `/api/madri-platform/context` acessível;
- API `/api/madri-platform/status-report` acessível.

## Produção
Este pacote **não pode ser executado em Produção**. O script aborta qualquer ambiente diferente de `stage`.
