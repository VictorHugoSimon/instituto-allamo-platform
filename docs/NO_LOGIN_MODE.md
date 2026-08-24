# Portal PMO sem login

## Regra funcional
Os dois hosts oficiais do Portal PMO abrem diretamente no sistema, sem e-mail e senha:

- `allamo-pmo-stage.pages.dev`
- `allamo-pmo.pages.dev`

Na ausência de `Authorization: Bearer ...`, o runtime atribui uma identidade sintética com papel `pmo` para manter as regras internas existentes de empresa, projeto, report, roadmap, trabalho e auditoria.

Quando uma requisição apresenta um Bearer token, a sessão real passa a ter prioridade sobre a identidade sintética. O backend valida o token na tabela de sessões e aplica o papel real do usuário.

## Comportamento esperado

- nenhuma tela de login é apresentada nos hosts oficiais para o uso cotidiano;
- F5/reload continua dentro do aplicativo;
- ausência/expiração de token não interrompe a navegação comum nesses hosts;
- o botão `Sair` é neutralizado e ocultado na experiência padrão sem login;
- links públicos de cliente continuam usando o contexto explícito de empresa/projeto;
- APIs e dados continuam usando `company_id`/`project_id` para segregação lógica;
- requisições `DELETE` feitas pela identidade PMO sintética são bloqueadas com HTTP `403` e código `authenticated_session_required`;
- uma sessão real válida pode exercer os controles administrativos permitidos ao seu papel, inclusive ações destrutivas quando a rota autorizar.

## Proteção de dados
O modo sem login é adequado para consulta e operação cotidiana, mas não deve fornecer capacidade destrutiva anônima. Por isso, exclusões são separadas da identidade sintética.

O smoke de Stage e Produção executa uma tentativa de `DELETE` contra um identificador propositalmente inexistente e exige resposta `403`. Esse teste comprova a proteção sem remover ou alterar dados reais.

Quando o binding D1 ainda estiver propagando imediatamente após um deploy, a API deve responder HTTP `503`, `code=db_unavailable`, `retryable=true` e `Retry-After`, em vez de produzir erro interno `500` por acesso a `DB.prepare` indefinido.

## Risco registrado
Sem autenticação de usuário no Portal, qualquer pessoa que obtenha a URL do host oficial poderá alcançar a aplicação com permissões PMO para operações não destrutivas. Portanto, a URL não deve ser tratada como mecanismo de segurança.

Caso seja necessário restringir o acesso ao próprio Portal sem reintroduzir login dentro da aplicação, aplicar uma camada de perímetro fora do Portal (por exemplo, Cloudflare Access/Zero Trust), preservando a experiência sem login na interface.

## Governança de release
Toda alteração deve passar pelos gates existentes de tenant isolation, data persistence, report scope, PWA/public portal, data freshness, bundle, runtime D1 readiness, D1 CLI safety, auth override e mutation safety antes de promoção de ambiente.
