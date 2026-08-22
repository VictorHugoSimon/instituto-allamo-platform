# Homologação de Casos da Valkíria

## Propósito
Separar claramente **cenário candidato** de **verdade homologada**.

`eval-data/candidates.jsonl` foi derivado de perguntas de suporte, mapa funcional, registros de POPs e atividades recentes. Nenhum item desse arquivo é aprovado automaticamente.

## Processo
1. Selecionar um candidato.
2. Reproduzir o fluxo na versão atual do Sallamos.
3. Validar a fonte homologada que prova a resposta.
4. Remover nomes de clientes, pessoas, documentos fiscais, e-mails, telefones e outros dados identificáveis.
5. Definir a decisão esperada.
6. Para resposta direta, escrever golden answer e termos obrigatórios.
7. Registrar homologador e evidência.
8. Mover o caso para `dataset.jsonl` com `dataset_type=production-real` e `approved=true`.
9. Executar `npm run evals:ready`.
10. Executar `npm run evals -- --base <STAGE_URL> --auto-token true`.

## O que não fazer
- não copiar conversa de cliente com dados identificáveis;
- não transformar worklog em resposta oficial;
- não inferir passo a passo ausente;
- não aprovar fonte só porque o nome parece oficial;
- não reduzir os gates para fazer a release passar.
