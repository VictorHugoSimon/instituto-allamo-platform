# Changeset — plataforma dinâmica multitenant

Este pacote consolida:

- first paint seguro: nenhum dado demo/hardcoded aparece durante F5 com sessão ou link público;
- campos dinâmicos sem criação de coluna física por campo (`tenant_field_definitions` / `tenant_field_values`);
- catálogo multitenant de arquivos (`tenant_files`) + bytes no R2 `DOCS`;
- arquivamento lógico de campos e arquivos;
- anexos de marco preservados fisicamente para histórico/auditoria;
- descrição/subdescrição/link/anexo diretamente em `Marcos e fases`;
- edição contextual de seções do Report sem abrir o editor completo;
- validação `company_id + project_id` em todos os novos recursos;
- migrations somente aditivas;
- gate CI dedicado.

Produção deve continuar bloqueada até homologação no Stage e configuração de bucket R2 separado por ambiente.
