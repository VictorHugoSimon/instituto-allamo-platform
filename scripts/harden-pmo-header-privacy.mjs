import fs from 'node:fs';

const file='public/index.html';
const runtimeFile='src/pmo-header-privacy-runtime.js';
const start='<!-- BEGIN ALLAMO PMO HEADER PRIVACY -->';
const end='<!-- END ALLAMO PMO HEADER PRIVACY -->';

let html=fs.readFileSync(file,'utf8');
const runtime=fs.readFileSync(runtimeFile,'utf8');
const block=`${start}\n<script id="allamo-pmo-header-privacy">\n${runtime}\n</script>\n${end}`;

// Remove a identificação diretamente do template oficial serializado. Assim o
// avatar/nome/cargo nunca chegam ao DOM, nem por um frame, após cada render.
const templateOpen='<script type="__bundler/template">';
const templateStart=html.indexOf(templateOpen);
if(templateStart<0)throw new Error('Template serializado do portal não encontrado.');
const templateBodyStart=templateStart+templateOpen.length;
const templateBodyEnd=html.indexOf('</script>',templateBodyStart);
if(templateBodyEnd<0)throw new Error('Fechamento do template serializado não encontrado.');

let template;
try{template=JSON.parse(html.slice(templateBodyStart,templateBodyEnd));}
catch(err){throw new Error(`Template serializado inválido: ${String(err&&err.message||err)}`);}

const actionsMarker='data-allamo-pmo-header-actions="1"';
if(!template.includes(actionsMarker)){
  const identityStart='<sc-if value="{{ showUserBox }}" hint-placeholder-val="{{ false }}">';
  const a=template.indexOf(identityStart);
  const b=a<0?-1:template.indexOf('</sc-if>',a);
  if(a<0||b<0)throw new Error('Bloco de usuário do header PMO não encontrado.');
  const legacyBlock=template.slice(a,b+'</sc-if>'.length);
  for(const required of ['{{ avatarHeaderEl }}','{{ userName }}','{{ roleLabel }}','sc-camel-on-click="{{ logout }}"','>Sair</button>','id="om-install"']){
    if(!legacyBlock.includes(required))throw new Error(`Contrato legado inesperado no header: ${required}`);
  }
  const safeActions=`<sc-if value="{{ showUserBox }}" hint-placeholder-val="{{ false }}">
    <div ${actionsMarker} style="display:flex;align-items:center;gap:11px;padding-left:6px">
      <button data-allamo-header-logout="1" sc-camel-on-click="{{ logout }}" title="Sair" style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:9px;padding:9px 13px;font-weight:700;font-size:12.5px;cursor:pointer" style-hover="background:rgba(255,255,255,.2)">Sair</button>
      <button id="om-install" sc-camel-on-click="{{ installPwa }}" style="align-items:center;background:#b88b78;border:0;color:#fff;border-radius:9px;padding:9px 13px;font-weight:800;font-size:12.5px;cursor:pointer">↓ Instalar app</button>
    </div>
    </sc-if>`;
  template=template.slice(0,a)+safeActions+template.slice(b+'</sc-if>'.length);
  const serialized=JSON.stringify(template).replace(/<\//g,'<\\u002F');
  html=html.slice(0,templateBodyStart)+serialized+html.slice(templateBodyEnd);
}

const headerStart=template.lastIndexOf('<header',template.indexOf(actionsMarker));
const headerEnd=template.indexOf('</header>',template.indexOf(actionsMarker));
const headerTemplate=template.slice(headerStart,headerEnd);
for(const forbidden of ['{{ avatarHeaderEl }}','{{ userName }}','{{ roleLabel }}']){
  if(headerTemplate.includes(forbidden))throw new Error(`Identificação ainda presente no header: ${forbidden}`);
}

if(html.includes(start)){
  const a=html.indexOf(start);
  const b=html.indexOf(end,a);
  if(b<0)throw new Error('Marcador final do hardening de privacidade do header ausente.');
  html=html.slice(0,a)+block+html.slice(b+end.length);
}else{
  const at=html.lastIndexOf('</body>');
  if(at<0)throw new Error('body externo do artefato não encontrado para privacidade do header.');
  html=html.slice(0,at)+block+'\n'+html.slice(at);
}

if(!html.includes('__allamoPmoHeaderPrivacyLoaded'))throw new Error('Runtime de privacidade do header não entrou no artefato.');
if(!html.includes('data-allamo-user-identity-free'))throw new Error('Marker de limpeza integral da identidade ausente.');
if(!template.includes(actionsMarker))throw new Error('Ações seguras do header não entraram no template oficial.');

fs.writeFileSync(file,html);
console.log('OK: identidade visual removida do header PMO; Sair e Instalar app permanecem independentes.');
