# Paridade visual Stage → Produção

A visão interna de `Portfólio > Empresas` homologada em Stage é tratada como contrato de release para Produção.

O artefato produtivo deve conter, no mínimo:
- KPIs: Empresas na carteira, Sistema próprio, Com dono definido e Sem responsável;
- cards de empresa com Acompanhar, Abrir, Editar e Excluir;
- projetos vinculados dentro do card da empresa e ação `+ Projeto nesta empresa`;
- navegação Visão Executiva, Empresas, Projetos, Trabalho e Reports;
- grupos Comunicação e Gestão & Ajuda;
- botão `↓ Instalar app` no cabeçalho.

## Proteções

- `scripts/validate-production-ui-parity.mjs` valida o artefato final após o build.
- `Production UI Parity CI` bloqueia PR para `main` se a interface homologada desaparecer.
- `scripts/smoke-production-ui-parity.mjs` consulta a URL pública depois do deploy e valida os mesmos marcadores.
- HTML de navegação deve responder com `Cache-Control: no-store`.
- Service Worker permanece network-first e não pode manter HTML antigo em cache persistente.

A correção não executa reset, exclusão ou migração destrutiva de dados.