# Estabilidade de Login e Sessão

Critérios obrigatórios para homologação do Portal PMO:

- o formulário de login nunca pode exibir bindings literais como `{{ emailVal }}` ou `{{ passwordVal }}`;
- digitação de e-mail e senha deve funcionar mesmo se o binding visual do componente falhar;
- autenticação deve usar `/api/login` sem cache;
- a senha nunca deve ser persistida em `localStorage` ou `sessionStorage`;
- sessão válida deve permanecer ativa durante falhas temporárias de rede/API;
- somente falha autenticatória confirmada deve invalidar a sessão local;
- sessão tem validade renovável de 7 dias;
- logout explícito revoga a sessão no servidor;
- mudanças de aba, empresa ou projeto com o mesmo token não podem provocar logout/reload em cascata em outras abas;
- troca real de token ou logout deve invalidar o contexto das outras abas;
- o bundle final deve permanecer JSON-parseável após todos os hardenings.

Validação automatizada principal: `npm run test:session`.
