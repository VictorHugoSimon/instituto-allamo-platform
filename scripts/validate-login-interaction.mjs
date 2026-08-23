import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const src=read('src/login-interaction-guard.js');
const hardener=read('scripts/harden-login-form.mjs');
const index=read('public/index.html');
const pkg=JSON.parse(read('package.json'));
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};

must(src,'__allamoLoginInteractionGuard','guard nativo idempotente');
must(src,'input[type="email"]','campo de e-mail nativo');
must(src,'input[type="password"]','campo de senha nativo');
must(src,"addEventListener('input'",'captura nativa de digitação');
must(src,"addEventListener('keydown'",'fallback de teclado');
must(src,"addEventListener('paste'",'colar credencial mantém origem manual');
must(src,"form.addEventListener('submit'",'submit nativo de login');
must(src,"fetch('/api/login'",'autenticação direta same-origin');
must(src,"cache:'no-store'",'login sem cache');
must(src,"localStorage.setItem('allamo_session'",'persistência da sessão após login');
must(src,"const edited={email:false,password:false}",'estado separa autofill de digitação manual');
must(src,"input.setAttribute('autocomplete',isPassword?'new-password':'off')",'guard bloqueia autofill persistente');
must(src,"input.setAttribute('data-lpignore','true')",'guard sinaliza ignore para gerenciadores');
must(src,"if(edited[kind])",'valor manual vira fonte de verdade');
must(src,"else if(input.value)",'autofill reaparecido é removido antes da digitação');
if(src.includes("autocomplete','username")||src.includes("autocomplete','current-password"))throw new Error('Guard ainda habilita autofill persistente de credenciais.');
if(/sessionStorage\.setItem\([^\n]*password|localStorage\.setItem\([^\n]*password/i.test(src))throw new Error('Senha não pode ser persistida no browser pelo guard.');
must(index,'__allamoLoginInteractionGuard','guard de login está no artefato final');

// O hardening do formulário precisa preservar a integridade do JSON embutido.
must(hardener,"replace(/<\\//gi,'<\\\\u002F')",'serialização segura contra fechamento prematuro de script');
must(hardener,'roundTrip!==template','round-trip do template validado');
must(hardener,'autocomplete="off"','template desabilita autofill de usuário');
must(hardener,'autocomplete="new-password"','template desabilita senha salva');

const open='<script type="__bundler/template">';
const a=index.indexOf(open);
if(a<0)throw new Error('Template do bundler não encontrado.');
const start=a+open.length;
const end=index.indexOf('</script>',start);
if(end<0)throw new Error('Fechamento do template do bundler não encontrado.');
const raw=index.slice(start,end);
let template;
try{template=JSON.parse(raw);}
catch(err){throw new Error('Template do bundler inválido: '+String(err&&err.message||err));}
if(template.includes('value="{{ emailVal }}"'))throw new Error('Campo de e-mail ainda pode exibir {{ emailVal }} literalmente.');
if(template.includes('value="{{ passwordVal }}"'))throw new Error('Campo de senha ainda pode exibir {{ passwordVal }} literalmente.');
must(template,'autocomplete="off"','campo de e-mail não solicita credencial salva');
must(template,'autocomplete="new-password"','campo de senha não solicita senha salva');
must(template,'name="allamo-login-user"','nome do input evita heurística genérica de usuário');
must(template,'name="allamo-login-secret"','nome do input evita heurística genérica de senha');
must(template,'data-lpignore="true"','template sinaliza gerenciadores para ignorar');
must(template,'sc-camel-on-input="{{ onEmail }}"','handler visual de e-mail preservado');
must(template,'sc-camel-on-input="{{ onPassword }}"','handler visual de senha preservado');
if(template.includes('autocomplete="username"')||template.includes('autocomplete="current-password"'))throw new Error('Template ainda habilita autofill persistente.');
if(template.toLowerCase().includes('</script') && !raw.includes('\\u002Fscript'))throw new Error('Template contém </script> decodificado, mas o JSON bruto não está protegido com \\u002F.');

const build=String(pkg.scripts['build:work']||'');
must(build,'build-work-management.mjs','pipeline principal existe');
must(build,'harden-login-form.mjs','hardening visual do login roda em todo build');
console.log('OK: login nasce vazio, usuário pode trocar credenciais, autofill não reaplica valores, senha não persiste e JSON permanece íntegro.');
