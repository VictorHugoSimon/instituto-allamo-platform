# Portal PMO sem login

## Regra funcional
Os dois hosts oficiais do Portal PMO abrem diretamente no sistema, sem e-mail e senha:

- `allamo-pmo-stage.pages.dev`
- `allamo-pmo.pages.dev`

O runtime atribui uma identidade sintética com papel `pmo` para manter as regras internas existentes de empresa, projeto, report, roadmap, trabalho e auditoria.

## Comportamento esperado

- nenhuma tela de login é apresentada nos hosts oficiais;
- F5/reload continua dentro do aplicativo;
- ausência/expiração de token não interrompe a navegação nesses hosts;
- o botão `Sair` é neutralizado e ocultado;
- links públicos de cliente continuam usando o contexto explícito de empresa/projeto;
- APIs e dados continuam usando `company_id`/`project_id` para segregação lógica.

## Risco registrado
Sem autenticação de usuário no Portal, qualquer pessoa que obtenha a URL do host oficial poderá alcançar a aplicação com permissões PMO. Portanto, a URL não deve ser tratada como mecanismo de segurança.

Caso seja necessário restringir acesso no futuro sem reintroduzir login dentro da aplicação, a recomendação é aplicar uma camada de perímetro fora do Portal (por exemplo, política de acesso da infraestrutura), preservando a experiência sem login na interface.

## Governança de release
Toda alteração deve passar pelos gates existentes de tenant isolation, data persistence, report scope, PWA/public portal, data freshness e bundle antes de promoção de ambiente.
