# Portal público do cliente — sem login

Requisito obrigatório:

- links compartilhados com o cliente nunca exigem autenticação;
- `?cliente=<empresa>` abre a empresa e lista todos os projetos públicos dela;
- `?cliente=<empresa>&projeto=<projeto>` abre diretamente o projeto selecionado e seus Reports publicados;
- APIs `public-client-projects` e `public-published-reports` são públicas e não dependem de token de sessão;
- sessão administrativa existente no navegador não pode mudar a empresa/projeto resolvidos pela URL pública;
- ausência ou expiração de sessão administrativa não pode redirecionar o link público para login;
- nenhuma busca pública pode fazer fallback para outra empresa;
- somente Reports com status `PUBLICADO` e campos marcados como visíveis ao cliente podem ser expostos;
- links inválidos mostram erro/empresa não encontrada, nunca a tela de login e nunca outro tenant.
