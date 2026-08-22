# Release Stabilization — Portal PMO

## Objetivo
Interromper o ciclo de hotfix/deploy e tornar o STAGE previsível.

## Regra de congelamento
Enquanto esta política estiver ativa, mudanças funcionais novas não devem ser promovidas ao STAGE. `develop` pode receber correções e testes, mas publicar exige uma release candidata explícita.

## Fluxo único
1. Consolidar correções em `develop`.
2. Executar `npm run build:work` uma única vez.
3. Executar `npm run test:release` sobre o mesmo artefato.
4. Se qualquer gate falhar, não publicar.
5. Se todos passarem, executar o workflow manual `Release STAGE - Manual Gate` informando `DEPLOY-STAGE`.
6. Homologar o mesmo commit no STAGE.
7. Bugs encontrados na homologação voltam para `develop` e só geram nova release candidata quando o conjunto estiver novamente estável.

## O que não acontece mais
- deploy automático a cada push em `develop`;
- reset de D1 durante deploy;
- restauração de baseline automática;
- rebuild entre validação e publicação;
- promoção para produção sem homologação do Stage.

## Gate consolidado
`npm run test:release` valida bundle, sessão, freshness/cache, isolamento multitenant, portal público, PWA, bootstrap live, baseline funcional, escopo de Reports, plataforma dinâmica, IA, recorrência, responsividade e isolamento de ambientes D1.

## Critério de saída da estabilização
A release candidata deve permanecer estável em homologação para os fluxos críticos: login/sessão, F5/múltiplas abas, empresa -> projetos -> Reports, links públicos por tenant, edição de Report, anexos, Work Management e persistência de dados.

## Produção
Produção permanece bloqueada até homologação formal do Stage. O artefato aprovado deve ser promovido sem reconstrução funcional e sem executar scripts destrutivos.
