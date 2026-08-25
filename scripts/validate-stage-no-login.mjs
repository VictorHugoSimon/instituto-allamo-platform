import fs from 'node:fs';

const worker=fs.readFileSync('public/_worker.js','utf8');
const html=fs.readFileSync('public/index.html','utf8');
const smoke=fs.readFileSync('scripts/smoke-core-tenants.mjs','utf8');
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};

must(worker,"portalNoLoginHost = /(^|\\.)(?:allamo-pmo-stage|allamo-pmo)\\.pages\\.dev$/i",'Bypass restrito aos dois hosts oficiais do Portal');
must(worker,"role:'pmo'",'Identidade PMO sintética interna no modo sem login');
must(worker,"__portal_no_login:true",'Marcador do modo sem login');
must(worker,"if (!token) return null;",'Hosts fora do Portal mantêm autenticação legada');

const open='<script type="__bundler/template">';
const start=html.indexOf(open);
if(start<0)throw new Error('Template do bundler ausente.');
const a=start+open.length,b=html.indexOf('</script>',a);
const template=JSON.parse(html.slice(a,b));
must(template,"const portalNoLogin=/(^|\\.)(?:allamo-pmo-stage|allamo-pmo)\\.pages\\.dev$/i.test(location.hostname||'');",'restoreSession detecta os hosts oficiais');
must(template,"role:'pmo', screen:'app'",'Portal entra direto no app');
must(template,"? 'app' : 'login'",'Estado inicial pula login nos hosts oficiais');
must(template,"? true : false",'Portal inicia live sem autenticação');
must(template,'const noLoginLogout=','Logout é neutralizado no modo sem login');
must(template,'allamo-no-login-identity-ui','Conjunto de autenticação é removido visualmente');
must(template,'data-allamo-hidden-identity','Nome/função/avatar próximos ao logout são ocultados');
must(template,"if((el.textContent||'').trim()!=='Sair')return",'Guard localiza o botão Sair sem afetar outros controles');
must(template,"/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(t)",'Guard não esconde sino/seletor/controles interativos vizinhos');
if(template.includes('allamo-no-login-ui'))throw new Error('Observer antigo de logout ainda permanece e pode duplicar tratamento do cabeçalho.');

must(smoke,"for(let i=1;i<=12;i++)",'Smoke destrutivo possui janela de retry pós-deploy');
must(smoke,"Aguardando propagação da proteção destrutiva",'Smoke registra propagação transitória sem falso negativo imediato');
must(smoke,"r.status===403&&data.code==='authenticated_session_required'",'Smoke continua exigindo bloqueio destrutivo real');
must(smoke,"após 12 tentativas",'Falha persistente continua derrubando a release');

console.log('OK: Stage e Produção abrem sem login e sem bloco visual de usuário/logout; controles permanecem disponíveis e o smoke destrutivo tolera somente propagação transitória, sem relaxar o bloqueio 403.');
