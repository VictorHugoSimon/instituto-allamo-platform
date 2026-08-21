# Reports Dinâmicos + Copiloto PMO IA

## Objetivo
Transformar o Status Report exibido na área de projeto/cliente em um artefato flexível, versionado e assistido por GPT.

Fluxo alvo:

`Reunião/documentos → IA compara com Report atual → rascunho → PMO aceita/edita/rejeita → nova versão → tarefas/roadmap opcionais`.

## Governança
- A IA nunca publica nem grava automaticamente.
- O PMO precisa aprovar as alterações.
- Percentuais, SPI, horas, custos, datas, Go-live, baseline, responsáveis e decisões só podem ser alterados quando houver evidência explícita.
- Go-live, baseline, escopo, orçamento/custo, contrato e sponsor são tratados como alterações críticas e exigem validação manual.
- Cada geração fica registrada em `report_ai_runs`.
- Cada salvamento do Status Report gera snapshot em `legacy_report_versions`.
- A primeira atualização após a implantação do recurso preserva o Report anterior como baseline histórica quando já existir dado salvo.

## Editor dinâmico
Dentro de **Editar Status Report** são adicionados:
- `+ Adicionar seção`;
- `+ Adicionar campo`;
- duplicar;
- mover seção/campo;
- ocultar do cliente;
- permitir/bloquear sugestão por IA;
- excluir somente da versão atual;
- ocultar/mostrar campos padrão do modelo.

Os campos flexíveis ficam em `data_json.custom_sections`; os campos padrão ocultos ficam em `data_json.hidden_standard_fields`. Não é necessária uma coluna de banco para cada campo novo.

Tipos suportados inicialmente:
`text`, `textarea`, `number`, `percentage`, `hours`, `date`, `status`, `select`, `list`, `person`, `risk`, `kpi`, `milestone`, `table`, `checklist`, `curve_s`, `chart`, `roadmap`, `separator`.

## Copiloto PMO
O botão **✨ Gerar Status Report com IA** aceita:
- resumo/ata/transcrição da reunião;
- evidência textual complementar;
- PDFs;
- TXT/MD/CSV/JSON;
- PNG/JPG/WEBP;
- instruções adicionais.

A análise usa a OpenAI **Responses API** com Structured Outputs em JSON Schema e `store:false`.

### Configuração necessária
Secret Cloudflare:
- `OPENAI_API_KEY`

Variável opcional:
- `OPENAI_REPORT_MODEL` — padrão: `gpt-5.6-terra`.

A API key nunca é enviada ao navegador.

## Integrações geradas pela IA
Após a análise, o PMO pode individualmente:
- criar uma `AÇÃO` no Work Management;
- adicionar um item ao plano/roadmap (`plan_items`);
- incluir resumo, riscos e decisões em campos adicionais do Report;
- aplicar alterações diretas de campos permitidos.

## Banco
Migration: `migrations/2026-08-21-report-ai-dynamic.sql`.

É create-only e cria:
- `legacy_report_versions`;
- `report_ai_runs`;
- índices associados.

O endpoint também usa `CREATE TABLE IF NOT EXISTS` como proteção de compatibilidade, sem excluir dados.

## Homologação Stage
1. Atualizar `develop` e executar `npm ci`.
2. Executar `node scripts/validate-report-ai-dynamic.mjs`.
3. Executar `node scripts/verify-data-persistence.mjs`.
4. Executar `npm run build:work`.
5. Publicar somente no Stage.
6. Abrir um projeto e **Editar Status Report**.
7. Criar uma seção e dois campos; salvar.
8. Reabrir e confirmar persistência.
9. Excluir um campo, salvar e consultar **Histórico**; a versão anterior deve manter o campo.
10. Ocultar um campo padrão e confirmar que a configuração é preservada.
11. Confirmar que **Gerar Status Report com IA** informa corretamente se a OpenAI ainda não estiver configurada.
12. Após configurar o secret em Stage, colar uma reunião com um valor quantitativo e outro sem evidência; confirmar que o primeiro pode ser sugerido e o segundo fica para validação/A confirmar.
13. Criar uma tarefa sugerida e um item de roadmap/plano.
14. Verificar novamente os dados existentes: empresas, projetos, tarefas e Reports não podem ser apagados.

## Produção
Não promover até:
- CI verde;
- Stage homologado;
- secret OpenAI configurado de forma segura;
- migration create-only revisada/backup realizado quando aplicável;
- smoke de persistência aprovado.
