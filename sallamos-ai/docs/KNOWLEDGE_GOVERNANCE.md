# Governança da base de conhecimento

## Fluxo obrigatório
`Fonte interna → exportação segura → sanitização → importação como RASCUNHO → revisão humana → HOMOLOGAÇÃO → embedding → disponível ao agente`.

Um documento importado nunca recebe status homologado automaticamente.

## Importação segura
`POST /api/ai/admin/knowledge/import` com `ADMIN_TOKEN`.

Campos: `title`, `module`, `version`, `owner`, `sourceType`, `sourceUri`, `content`.

O serviço:
1. valida metadados e limite de tamanho;
2. aplica redaction antes de persistir;
3. grava a cópia sanitizada no R2;
4. cria documento/chunks em D1 com status `rascunho`;
5. registra auditoria;
6. não gera embeddings de rascunhos.

Também existe o utilitário local `scripts/import-knowledge.mjs` para arquivos `.txt`/`.md` exportados de fontes internas.

## Homologação
`POST /api/ai/admin/knowledge/{documentId}/approve`

Body mínimo:
```json
{"approvedBy":"responsável funcional","approvalEvidence":"referência da revisão/homologação"}
```

Após aprovação, o documento vira `homologado`, seus chunks ficam pendentes de embedding e o cron/reindex atualiza o Vectorize com metadata homologada.

## Rejeição
`POST /api/ai/admin/knowledge/{documentId}/reject`

Documento rejeitado não participa do retrieval.

## Regras
- Fonte sem owner não pode ser homologada.
- A IA não pode homologar a própria fonte.
- Conteúdo interno não deve ser copiado para repositório público apenas para alimentar o RAG.
- Documento de cliente só entra como fonte global após sanitização e validação de que a regra é realmente geral do produto.
- Material comercial não substitui manual/regra de negócio.
- Documentação antiga pode servir como referência histórica, mas deve permanecer fora do retrieval produtivo até reconfirmação funcional.
- Toda aprovação/rejeição entra em `action_audit`.
