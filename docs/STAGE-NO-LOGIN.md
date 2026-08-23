# Stage sem login

O ambiente `allamo-pmo-stage.pages.dev` e seus previews de Pages funcionam sem autenticação para acelerar homologação funcional.

## Regras

- O Stage abre diretamente no Portal PMO com perfil sintético `pmo`.
- O bypass é restrito por hostname a `allamo-pmo-stage.pages.dev` e subdomínios de preview desse projeto.
- `allamo-pmo.pages.dev` não participa do bypass e continua exigindo sessão/token.
- Não há reset de dados, alteração destrutiva ou migração associada a esta mudança.
- A remoção do login em Produção exige decisão separada e revisão de segurança.

## Critério de homologação

1. Abrir o Stage em janela anônima sem sessão/localStorage.
2. Confirmar que não aparece tela de login.
3. Confirmar leitura de empresas/projetos/reports.
4. Criar ou editar um registro de teste e confirmar persistência após F5.
5. Confirmar que o domínio de Produção continua protegido.
