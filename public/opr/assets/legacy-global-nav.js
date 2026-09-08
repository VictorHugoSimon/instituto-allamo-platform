(()=>{
'use strict';
const groups=[
 ['Início',[['/opr/','01 · Visão Geral']]],
 ['Entender e planejar',[['/opr-blueprint/','02 · Blueprint'],['/opr-plano-de-acao/','03 · Plano de Ação'],['/opr-requisitos/','04 · Requisitos']]],
 ['Executar e controlar',[['/opr-integracoes/','05 · Integrações'],['/opr-riscos/','06 · Riscos'],['/opr-mapa-implantacao/','07 · Mapa Mestre']]],
 ['Validar e decidir',[['/opr-plano-testes/','08 · Testes'],['/opr-defeitos/','09 · Defeitos'],['/opr-readiness/','10 · Readiness'],['/opr-decisoes/','11 · Decisões']]],
 ['Governança e conhecimento',[['/opr-status-report/','12 · Status Report'],['/opr-pop/','13 · POP'],['/opr-documentos/','14 · Documentos'],['/opr-biblioteca/','15 · Biblioteca / Drive']]]
];
const norm=p=>String(p||'/').replace(/\/+$/,'/')||'/';
function mount(){
 const side=document.querySelector('.sidebar');if(!side||side.querySelector('[data-opr-global-nav]'))return;
 const current=norm(location.pathname),wrap=document.createElement('div');wrap.dataset.oprGlobalNav='1';wrap.className='opr-global-nav';
 wrap.innerHTML=groups.map(([name,items])=>`<div class="ogn-group"><div class="ogn-label">${name}</div>${items.map(([u,l])=>`<a href="${u}" ${norm(u)===current?'class="ogn-on" aria-current="page"':''}>${l}</a>`).join('')}</div>`).join('')+'<div class="ogn-local">Neste módulo ↓</div>';
 const brand=side.querySelector('.brand');if(brand)brand.insertAdjacentElement('afterend',wrap);else side.prepend(wrap);
 const st=document.createElement('style');st.textContent=`.opr-global-nav{padding:4px 0 10px;border-bottom:1px solid #ffffff18;margin-bottom:9px}.ogn-group{margin:0 0 7px}.ogn-label{padding:3px 10px;font-size:7.5px;letter-spacing:1.1px;text-transform:uppercase;color:#a9a5ac;font-weight:900}.opr-global-nav a{display:block;text-decoration:none;color:#d7d3d8;padding:6px 10px;border-radius:8px;font-size:9.5px;font-weight:750;margin:1px 0;line-height:1.25}.opr-global-nav a:hover,.opr-global-nav a.ogn-on{background:#ffffff12;color:#fff}.opr-global-nav a.ogn-on{box-shadow:inset 3px 0 0 #b88b78;background:#ffffff16}.opr-global-nav a:focus-visible{outline:2px solid #fff;outline-offset:2px}.ogn-local{font-size:7.5px;text-transform:uppercase;letter-spacing:1.1px;color:#d9ad9a;font-weight:900;padding:8px 10px 1px}@media(max-width:980px){.opr-global-nav{display:flex;overflow:auto;gap:8px;padding-bottom:8px}.ogn-group{min-width:max-content}.ogn-label{display:none}.opr-global-nav a{white-space:nowrap}.ogn-local{display:none}}`;
 document.head.appendChild(st);
 requestAnimationFrame(()=>wrap.querySelector('.ogn-on')?.scrollIntoView({block:'nearest',inline:'nearest'}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
