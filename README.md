# Portal PMO — Instituto Államo
Front + API + banco para rodar **grátis** na Cloudflare (Pages + Functions + D1).

## O que tem aqui
- `public/index.html` — o portal (front autônomo, abre em qualquer navegador).
- `functions/api/[[path]].js` — a API (Cloudflare Pages Functions). Login por e-mail/senha, dados e aprovação de GMUD, com controle de acesso por perfil e por empresa.
- `schema.sql` — estrutura do banco D1 (empresas, projetos, demandas, GMUD, viradas, documentos, usuários, sessões).
- `seed.sql` — seus dados reais já prontos para carregar.
- `wrangler.toml` / `package.json` — configuração de deploy.

## Perfis de acesso
| Perfil | Enxerga |
|---|---|
| **admin** | Tudo + gestão de acessos |
| **pmo** | Todo o portfólio (sem gestão de acessos) |
| **gestor** | Só a própria empresa · pode aprovar GMUD |
| **usuario** | Só a própria empresa · leitura |

## Subir no ar (passo a passo, sem programar)
1. **Instale o Wrangler** (uma vez, no seu PC): `npm install -g wrangler` e depois `wrangler login`.
2. **Crie o banco:** `wrangler d1 create allamo-pmo` → copie o `database_id` que aparece e cole em `wrangler.toml`.
3. **Monte as tabelas:** `npm run db:init`
4. **Carregue os dados:** `npm run db:seed`
5. **Publique:** `npm run deploy` — o Wrangler te dá a URL pública (algo como `allamo-pmo.pages.dev`).

### Alternativa 100% pelo site (sem terminal)
- Em **dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git**, escolha o repositório `VictorHugoSimon/painel-pmo-instituto-allamo`.
- Build command: *(vazio)* · Output directory: `public`.
- Em **Settings → Functions → D1 database bindings**, crie o D1 `allamo-pmo` e vincule com o nome **DB**.
- Rode `schema.sql` e `seed.sql` pela aba **D1 → Console** (cole e execute).

## Login (senhas iniciais — trocar após o 1º acesso)
O `seed.sql` já grava os hashes prontos. Credenciais de teste:

| E-mail | Senha | Perfil |
|---|---|---|
| renan.rondon@institutoallamo.com.br | allamo123 | Admin |
| fabio.landin@institutoallamo.com.br | allamo123 | PMO |
| gestor@esposende.com.br | esposende123 | Gestor (Esposende) |
| ti@fergranos.com.br | fergranos123 | Usuário (FerGranos) |

Para trocar uma senha: `node set-password.mjs email "novaSenha"` → copie o `UPDATE` gerado e rode no D1 Console.

## Front ligado ao banco (ao vivo)
O `public/index.html` já faz **login real** e **carrega os dados da API** (`/api/*`) quando publicado. Sem servidor (abrindo direto), cai no **modo demo** com os 4 acessos rápidos — útil para apresentar sem deploy.
