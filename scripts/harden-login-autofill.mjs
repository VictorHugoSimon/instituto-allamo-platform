import fs from 'node:fs';

const file='public/index.html';
let html=fs.readFileSync(file,'utf8');
const open='<script type="__bundler/template">';
const close='</script>';
const a=html.indexOf(open);
if(a<0) throw new Error('Template do bundler não encontrado.');
const js=a+open.length;
const je=html.indexOf(close,js);
if(je<0) throw new Error('Fechamento do template não encontrado.');
let template=JSON.parse(html.slice(js,je));
if(typeof template!=='string') throw new Error('Template não é string.');

// Login deve ler os valores visíveis/reais do DOM. O Chrome pode preencher o campo sem sincronizar o state.
const oldSubmit="    const { email, password } = this.state;\n    if (!email || !password) { this.setState({ loginError: 'Informe e-mail e senha.' }); return; }";
const newSubmit="    const form = e.currentTarget || e.target;\n    const emailInput = form && form.querySelector ? form.querySelector('input[name=\\\"email\\\"],input[type=\\\"email\\\"]') : null;\n    const passwordInput = form && form.querySelector ? form.querySelector('input[name=\\\"password\\\"],[data-allamo-password]') : null;\n    const email = String((emailInput && emailInput.value) || this.state.email || '').trim();\n    const password = String((passwordInput && passwordInput.value) || this.state.password || '');\n    if (!email || !password) { this.setState({ loginError: 'Informe e-mail e senha.' }); return; }\n    if (email !== this.state.email || password !== this.state.password) this.setState({ email, password });";
if(template.includes(oldSubmit)) template=template.split(oldSubmit).join(newSubmit);
if(!template.includes("form.querySelector('input[name=\\\"email\\\"]")) throw new Error('Submit DOM-aware não aplicado.');

// Ajuda o password manager do navegador e dá seletores estáveis ao runtime do olho.
template=template.split('type="email" value="{{ emailVal }}"').join('type="email" name="email" autocomplete="username" inputmode="email" value="{{ emailVal }}"');
template=template.split('type="password" value="{{ passwordVal }}"').join('type="password" name="password" autocomplete="current-password" data-allamo-password="1" value="{{ passwordVal }}"');
if(!template.includes('autocomplete="current-password"')) throw new Error('Autocomplete de senha não aplicado.');

const runtime=`<script id="allamo-login-autofill-runtime">\n(()=>{\n  if(window.__allamoLoginAutofillLoaded)return; window.__allamoLoginAutofillLoaded=true;\n  function enhance(){\n    document.querySelectorAll('input[name="email"],input[type="email"]').forEach(i=>{i.name='email';i.autocomplete='username';});\n    document.querySelectorAll('[data-allamo-password],input[name="password"]').forEach(input=>{\n      input.name='password';input.autocomplete='current-password';input.setAttribute('data-allamo-password','1');\n      const label=input.closest('label')||input.parentElement;if(!label)return;\n      if(label.querySelector('[data-allamo-password-toggle]'))return;\n      const prevPos=getComputedStyle(label).position;if(!prevPos||prevPos==='static')label.style.position='relative';\n      input.style.paddingRight='46px';\n      const b=document.createElement('button');b.type='button';b.setAttribute('data-allamo-password-toggle','1');b.setAttribute('aria-label','Mostrar senha');b.title='Mostrar senha';b.textContent='👁';\n      b.style.cssText='position:absolute;right:9px;bottom:8px;width:34px;height:34px;border:0;background:transparent;cursor:pointer;border-radius:8px;font-size:17px;display:grid;place-items:center;z-index:3';\n      b.addEventListener('click',()=>{const show=input.type==='password';input.type=show?'text':'password';b.textContent=show?'🙈':'👁';b.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');b.title=show?'Ocultar senha':'Mostrar senha';input.focus();});\n      label.appendChild(b);\n    });\n  }\n  const mo=new MutationObserver(enhance);mo.observe(document,{childList:true,subtree:true});\n  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',enhance):enhance();\n  setTimeout(enhance,250);setTimeout(enhance,900);\n})();\n</script>`;
if(!template.includes('allamo-login-autofill-runtime')) template=template.replace('</body>',runtime+'\n</body>');
if(!template.includes('data-allamo-password-toggle')) throw new Error('Botão de visualizar senha não aplicado.');

const serialized=JSON.stringify(template);JSON.parse(serialized);
html=html.slice(0,js)+serialized+html.slice(je);
fs.writeFileSync(file,html);
console.log('OK: login lê autofill real do navegador e possui mostrar/ocultar senha.');
