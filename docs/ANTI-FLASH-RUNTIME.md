# Correção de flash de dados antigos no Portal PMO

## Problema
Durante F5/reload, o bundle estático pode renderizar uma fotografia antiga do estado antes de as APIs autenticadas retornarem. O runtime do bundle também possuía um overlay técnico de erro visível ao usuário.

## Correções
- boot guard oculta o corpo do app enquanto os primeiros requests `/api/` estabilizam;
- timeout máximo de 6s para evitar tela permanentemente oculta;
- overlay técnico `__bundler_err` fica invisível e erros seguem para o console;
- Service Worker v2 não cacheia navegações HTML nem `/api`;
- caches antigos são removidos na ativação;
- assets estáticos mantêm fallback de cache.

## Critério de aceite
1. F5 na tela autenticada não exibe empresas/projetos/tarefas de estado anterior.
2. F5 na tela de login não exibe overlay técnico, códigos ou stack trace.
3. API continua sempre online/no-store.
4. Em caso de erro JS, usuário não recebe painel técnico; diagnóstico permanece no DevTools.
5. O app é revelado apenas após janela de estabilidade dos requests iniciais ou timeout de segurança.
