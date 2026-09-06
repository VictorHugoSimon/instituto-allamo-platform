# Contrato de Dados — Cockpit Executivo PMO 2.0

## Regra central
O Cockpit nunca converte ausência de informação em zero real.

## Portfólio
Entrada mínima por projeto:
- `id`;
- `company_id`;
- `status`;
- risco quando disponível;
- referência do último Status Report quando disponível.

## Saúde
Classificação inicial:
- `green`: projeto com informação disponível e sem evidência de risco/atraso;
- `yellow`: projeto marcado em risco/atenção ou risco alto;
- `red`: projeto atrasado/bloqueado ou risco crítico;
- `stale`: projeto sem Status Report/atualização suficiente para inferir saúde.

`stale` não é verde, amarelo ou vermelho. É ausência de evidência recente.

## Contagens
- empresas = quantidade real da coleção consultada;
- projetos = quantidade real da coleção consultada;
- ativo = projeto não concluído/cancelado;
- em andamento = status explicitamente mapeado para execução;
- em risco = status explicitamente mapeado para risco/atenção;
- atrasado = status explicitamente atrasado/bloqueado;
- backlog = status explicitamente backlog/planejado;
- concluído = status explicitamente concluído.

## Métricas indisponíveis
Qualquer métrica sem fonte confiável deve retornar/exibir `Não disponível`, nunca `0` por fallback.

## Evolução
Antes de produção, os mapeamentos de status devem ser comparados aos valores reais existentes no D1 para evitar classificação incorreta.
