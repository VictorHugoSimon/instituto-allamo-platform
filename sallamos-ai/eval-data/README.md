# Dataset de homologação do Sallamos AI

O go-live exige **20 a 30 dúvidas reais sanitizadas**, com respostas/evidências homologadas pelo time responsável. O arquivo `dataset.jsonl` atual contém apenas casos de POC e **não libera produção**.

## Campos obrigatórios para cada caso produtivo

```json
{
  "id": "FIN-001",
  "dataset_type": "real_sanitized",
  "approved": true,
  "owner": "homologador responsável",
  "module": "financeiro",
  "difficulty": "media",
  "question": "pergunta real sem PII",
  "expect_decision": "answer",
  "expected_source": "id da fonte homologada",
  "golden_answer": "resposta de referência homologada",
  "evidence": "documento/release/ticket sanitizado que sustenta a resposta"
}
```

## Regras
- mínimo 20 casos antes do go-live;
- pelo menos 3 módulos;
- deve haver exemplos de `answer`, `clarify` e `escalate`;
- casos `answer` exigem fonte esperada;
- `answer` e `clarify` exigem `golden_answer`;
- todos os casos exigem `approved=true`, owner e evidência;
- casos demo não são aceitos para produção;
- remover nomes de clientes/pessoas quando desnecessários e qualquer CPF, CNPJ, e-mail, telefone, credencial ou dado bancário;
- a aprovação deve representar revisão humana funcional, não texto produzido automaticamente pela própria IA.

## Comando

`npm run evals:ready`

O mesmo gate roda automaticamente antes de qualquer provisionamento produtivo.
