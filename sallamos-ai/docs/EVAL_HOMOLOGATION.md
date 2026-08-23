# Homologação de Casos da Valkíria

## Propósito
Separar claramente **cenário candidato** de **verdade homologada**.

`eval-data/candidates.jsonl` foi derivado de perguntas de suporte, mapa funcional, registros de POPs e atividades recentes. Nenhum item desse arquivo é aprovado automaticamente.

A operação humana é feita na planilha do Google Drive **Sallamos AI - Homologação dos Casos de Suporte - 2026-08-22**, criada com os 32 cenários candidatos. A planilha não libera produção sozinha.

## Processo
1. Selecionar um candidato na planilha.
2. Reproduzir o fluxo na versão atual do Sallamos.
3. Validar a fonte homologada que prova a resposta.
4. Remover nomes de clientes, pessoas, documentos fiscais, e-mails, telefones e outros dados identificáveis.
5. Definir a decisão esperada.
6. Para resposta direta, escrever golden answer e termos obrigatórios.
7. Registrar homologador e evidência.
8. Marcar `Status revisão=homologado` e `Aprovado?=SIM` somente após a validação funcional.
9. Exportar a aba `Casos` do Google Sheets como CSV.
10. Gerar o dataset de forma segura:

```bash
npm run evals:build -- --csv ./homologacao.csv --output eval-data/dataset.generated.jsonl
```

O conversor:
- usa somente linhas `homologado + SIM`;
- cria `dataset_type=production-real`;
- converte `cand-001` em `prod-001` para manter rastreabilidade;
- rejeita campos obrigatórios incompletos;
- rejeita PII provável;
- executa automaticamente o gate estrutural mínimo de 20 casos/3 módulos/decisões;
- grava o arquivo final somente se a validação passar.

11. Revisar o diff do arquivo gerado e, após aprovação, substituir `eval-data/dataset.jsonl` pelo conteúdo homologado.
12. Executar `npm run evals:ready`.
13. Executar `npm run evals -- --base <STAGE_URL> --auto-token true`.

## O que não fazer
- não copiar conversa de cliente com dados identificáveis;
- não transformar worklog em resposta oficial;
- não inferir passo a passo ausente;
- não aprovar fonte só porque o nome parece oficial;
- não reduzir os gates para fazer a release passar;
- não editar `dataset.jsonl` manualmente quando o CSV homologado estiver disponível.
