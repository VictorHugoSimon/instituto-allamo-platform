# Marcos, Evidências e Fluxo Recorrente de Reports

## Objetivo
Transformar o acompanhamento de projeto em uma linha do tempo auditável e multiempresa/multiprojeto:

Empresa → Projeto → Série de Reports → Ciclo → Status Report → Fases/Marcos → Evidências.

## Regras de segregação
- Todo Report possui `company_id` e `project_id`.
- Todo ciclo recorrente herda empresa/projeto da série, nunca do formulário de fechamento.
- Todo detalhe/anexo de marco possui `company_id` e `project_id`.
- O backend valida que `projects.company_id` coincide com a empresa informada.
- Links públicos exigem a empresa da URL e nunca retornam conteúdo de outra empresa.
- Arquivos públicos exigem `client_visible=1` e o projeto também é revalidado contra a empresa.

## Fluxo de Reports
1. Configurar recorrência do projeto: semanal, quinzenal ou mensal.
2. Registrar reuniões ao longo do ciclo.
3. Preparar o próximo Report com IA.
4. Revisar/aprovar as alterações sugeridas.
5. Atualizar o Status Report vivo.
6. Fechar o ciclo.
7. O sistema cria um snapshot imutável e encadeado ao ciclo anterior.
8. Se publicado, aparece no painel da empresa.

## Marcos e fases
Cada item de `phases[].items[]` pode receber:
- descrição;
- subdescrição / evidência do realizado;
- links externos;
- documentos;
- visibilidade para o cliente.

Os metadados ficam no D1. No fechamento de ciclo, uma cópia segura dos metadados é incorporada ao snapshot do Report para preservar o histórico daquela edição.

## Armazenamento de arquivos
Arquivos físicos usam o binding R2 `DOCS`. O código funciona sem o binding para descrições e links; o botão de arquivo avisa que o armazenamento ainda precisa ser configurado.

Recomendação de buckets:
- Stage: `allamo-pmo-docs-stage`
- Produção: `allamo-pmo-docs`

Depois de criar os buckets, configurar o binding `DOCS` no projeto Pages correspondente e fazer um novo deploy.

Arquivos:
- limite aplicado pela aplicação: 20 MB;
- chave R2 isolada por `empresa/projeto/id/arquivo`;
- acesso autenticado para equipe interna;
- acesso público somente quando `client_visible=1` e a empresa do link coincide com o anexo.

## Visualização/exportação
O viewer de Report possui aba Documentação com os marcos e evidências do ciclo. Links abrem em nova aba. Arquivos usam visualização inline quando suportada pelo navegador. O botão `Exportar / PDF` usa a impressão do navegador para salvar o Report em PDF.

## Gate de segurança
`npm run test:tenant` valida contratos de isolamento entre empresas/projetos, snapshot de evidências, namespace de arquivos, acesso público e ausência de migration destrutiva.
