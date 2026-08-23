# Arquitetura dinâmica e multitenant — Portal PMO Államo

## Princípio
O Portal não cria/remove coluna física no D1 a cada novo campo de tela. Campos configuráveis usam `tenant_field_definitions` + `tenant_field_values`, com valor em JSON tipado. Isso evita migrations concorrentes, perda de histórico e acoplamento entre tenants.

## Isolamento
Toda definição, valor e arquivo possui `company_id`; quando aplicável também `project_id`. APIs revalidam que o projeto pertence à empresa antes de ler/gravar.

## Campos dinâmicos
- `tenant_field_definitions`: chave, rótulo, tipo, configuração, obrigatoriedade, visibilidade ao cliente e ordenação.
- `tenant_field_values`: valor por entidade (`entity_type + entity_id`).
- criação/edição sem alteração de schema físico;
- exclusão padrão = arquivamento lógico (`archived_at`), preservando auditoria;
- tipos suportados incluem texto, número, percentual, data, status, listas, risco, KPI, marco, tabela, checklist, Curva S, gráfico, roadmap e JSON.

## Arquivos
- D1 guarda metadados em `tenant_files`;
- R2 (`DOCS`) guarda bytes do arquivo;
- chave física inclui empresa/projeto/entidade/id;
- limite de aplicação: 20 MB por arquivo;
- arquivo pode ser visível ou não para cliente;
- exclusão normal apenas arquiva; o objeto físico é preservado para histórico/auditoria;
- restauração é suportada no catálogo genérico.

## Marcos e fases
Cada marco pode ter:
- descrição;
- subdescrição/atualização;
- links;
- anexos físicos;
- visibilidade ao cliente.

Esses elementos aparecem diretamente na área `Marcos e fases` e também no editor completo.

## Reports recorrentes
Ao fechar um ciclo, o snapshot do Report leva uma fotografia das evidências dos marcos daquele momento. Alterações futuras não mudam retroativamente Reports antigos.

## R2
O código trata `env.DOCS` como binding opcional. Sem o binding, descrição/subdescrição/links funcionam e o upload físico informa que o armazenamento ainda não foi habilitado.

Configuração recomendada por ambiente:
- Stage: bucket dedicado de homologação;
- Produção: bucket dedicado de produção;
- nunca compartilhar o mesmo namespace operacional entre Stage e Produção.

## Segurança
O link público recebe apenas o tenant indicado pela URL e somente conteúdo explicitamente visível ao cliente. Conteúdo interno é removido no backend antes da resposta pública.
