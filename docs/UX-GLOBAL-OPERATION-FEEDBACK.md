# Padrão global de feedback de execução — Portal PMO Államo

## Objetivo
Nenhuma ação relevante do Portal PMO pode parecer silenciosa, travada ou sem resposta enquanto estiver sendo executada.

## Regra
Toda operação que crie, salve, publique, envie, exclua, sincronize, gere conteúdo, autentique ou dependa de resposta assíncrona deve exibir feedback visual enquanto estiver pendente.

## Comportamento padrão
- Operações de escrita (`POST`, `PUT`, `PATCH`, `DELETE`) exibem o indicador imediatamente.
- Operações de leitura (`GET`) exibem o indicador quando ultrapassarem 450 ms, evitando flashes em leituras rápidas.
- O indicador permanece visível enquanto houver uma ou mais operações relevantes pendentes.
- Em concorrência, a interface informa a quantidade de operações em andamento.
- Operações de escrita bem-sucedidas exibem confirmação breve.
- Falhas de escrita exibem feedback de erro sem substituir o tratamento específico da funcionalidade.
- Uploads mostram preparação do arquivo antes da chamada à API.
- O componente utiliza `aria-live`, `role=status` e `aria-busy` para acessibilidade.

## Mensagens contextuais
A camada reconhece operações como login, IA, upload, Reports, publicação, projetos, empresas, usuários, GMUD, Work Management, sincronização Linear, sincronização de horas e exclusões. Para endpoints novos, usa mensagem genérica segura.

## Extensão para futuras funções
Código que execute uma espera sem `fetch('/api/...')` pode usar:

```js
const op = window.AllamoOperation.start('Processando informação…');
try {
  // operação assíncrona
  window.AllamoOperation.finish(op, { ok: true, success: 'Concluído.' });
} catch (e) {
  window.AllamoOperation.finish(op, { ok: false, error: 'Não foi possível concluir.' });
}
```

Assim o mesmo padrão visual pode ser utilizado por novas funcionalidades sem duplicar componentes.
