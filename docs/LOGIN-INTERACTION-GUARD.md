# Login Interaction Guard

## Problema
Em alguns deployments imutáveis do Cloudflare Pages, a tela de login podia renderizar normalmente, mas o binding visual do componente não processava eventos de teclado. O campo recebia foco, porém o texto digitado não permanecia e o submit dependia do runtime visual.

## Proteção
O Portal inclui um guard nativo e idempotente que:
- localiza o formulário de login por e-mail e senha;
- captura `input`, `change` e `keydown` diretamente no DOM;
- preserva o valor digitado durante re-renderizações do shell;
- envia o login diretamente para `/api/login` com `no-store`;
- grava somente a sessão autenticada em `allamo_session` e recarrega o portal;
- nunca persiste a senha em `localStorage` ou `sessionStorage`.

## Critérios de homologação
1. Digitar e apagar livremente no campo E-mail.
2. Digitar e apagar livremente no campo Senha.
3. Enter e botão Entrar devem disparar autenticação.
4. Credencial inválida deve mostrar erro sem travar os campos.
5. Login válido deve persistir a sessão e abrir o portal.
6. F5 não deve deslogar sessão válida.
7. Alteração de aba/empresa em outra guia não deve derrubar esta sessão.
8. Logout explícito deve revogar a sessão.

O guard é uma camada de resiliência do login e não substitui a autorização do backend.
