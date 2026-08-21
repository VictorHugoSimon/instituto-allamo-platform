# Política de Persistência de Dados — Portal PMO Államo

## Regra permanente
A partir do início do uso real da plataforma, deploy de código nunca deve apagar dados de negócio.

Dados persistentes incluem, entre outros:
- empresas;
- projetos;
- demandas e tarefas;
- sprints;
- comentários e checklists;
- reports e versões;
- itens de roadmap;
- documentos, notificações, auditoria e demais registros operacionais.

## Deploy
Deploy pode:
- publicar código novo;
- criar novas tabelas/índices com migrations compatíveis;
- adicionar colunas de forma controlada;
- corrigir regras de aplicação.

Deploy não pode:
- executar reset automático;
- executar `DELETE FROM` em massa;
- executar `DROP TABLE`/`DROP DATABASE`;
- truncar tabelas;
- recriar baseline zerado;
- substituir dados reais por dados demo.

## Migrations
Toda migration de Produção deve ser revisada antes da execução e, quando houver alteração estrutural relevante, precedida de backup do D1.

Migrations destrutivas exigem decisão executiva explícita, plano de rollback e janela controlada. Não fazem parte do fluxo normal de deploy.

## Stage
O Stage também opera em modo persistente. Reset automático foi desativado. Quando for necessário criar um ambiente limpo de testes, deve ser utilizado um banco/ambiente temporário dedicado, nunca o banco em uso.

## Produção
Produção é sempre persistente. Nenhum código condicionado a hostname, build ou release pode apagar registros automaticamente.

## Critério de aceite de release
Uma release só pode ser promovida quando:
1. build e CI estiverem verdes;
2. migrations forem não destrutivas ou explicitamente aprovadas;
3. não existir reset automático no bootstrap de deploy;
4. dados existentes permanecerem intactos após o deploy;
5. smoke test confirmar leitura e gravação dos registros já existentes.
