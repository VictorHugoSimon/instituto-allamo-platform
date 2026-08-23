# Incidente — Empresas desapareceram da carteira

Data do registro: 2026-08-23

Empresas reportadas: Dual, Madrie e OPR.

## Regra de contenção

Não recriar empresas até confirmar o estado no D1. Recriação sem diagnóstico pode duplicar IDs, projetos, reports, anexos e histórico.

## Hipóteses

1. Falha transitória da API de empresas convertida em lista vazia no frontend.
2. Escopo/sessão restringindo a carteira.
3. Exclusão explícita registrada no `audit_log`.
4. Registros nunca persistidos no D1 e anteriormente exibidos apenas pela fotografia embarcada do protótipo.

## Validação necessária no D1 Stage

Executar consultas somente leitura em `companies` e `audit_log` para localizar Dual, Madrie/OPR e qualquer evento `empresa:excluir`.

## Correção preventiva

Falha de sincronização não pode substituir a última coleção válida por `[]`. Somente resposta válida da API pode atualizar a carteira renderizada; falhas temporárias devem manter estado válido e agendar nova sincronização.
