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
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function mount(){
  const side=document.querySelector('.sidebar');
  if(!side||document.querySelector('[data-opr-global-nav]'))return;
  const current=norm(location.pathname);
  const launcher=document.createElement('div');
  launcher.dataset.oprGlobalNav='1';
  launcher.className='opr-portal-launcher';
  launcher.innerHTML='<button type="button" class="opr-portal-open" aria-expanded="false" aria-controls="oprPortalDrawer"><span class="opr-portal-icon">☰</span><span><b>Portal OPR</b><small>Navegação geral · 01–15</small></span><span class="opr-portal-chevron">›</span></button>';
  const brand=side.querySelector('.brand');
  if(brand)brand.insertAdjacentElement('afterend',launcher);else side.prepend(launcher);

  const backdrop=document.createElement('div');
  backdrop.className='opr-portal-backdrop';
  backdrop.hidden=true;
  const drawer=document.createElement('aside');
  drawer.id='oprPortalDrawer';
  drawer.className='opr-portal-drawer';
  drawer.setAttribute('aria-hidden','true');
  drawer.innerHTML=`<div class="opr-portal-drawer-head"><div><span>Instituto Államo · PMO</span><h2>Portal OPR</h2><p>Jornada completa do projeto</p></div><button type="button" class="opr-portal-close" aria-label="Fechar navegação">×</button></div><nav class="opr-portal-groups">${groups.map(([name,items])=>`<section><h3>${esc(name)}</h3>${items.map(([u,l])=>`<a href="${u}" ${norm(u)===current?'class="is-current" aria-current="page"':''}><span>${esc(l)}</span>${norm(u)===current?'<em>Atual</em>':''}</a>`).join('')}</section>`).join('')}</nav><div class="opr-portal-drawer-foot"><b>Fluxo recomendado</b><span>entender → planejar → executar → controlar → testar → decidir → reportar → documentar</span></div>`;
  document.body.append(backdrop,drawer);

  const st=document.createElement('style');
  st.textContent=`
  .opr-portal-launcher{padding:0 0 10px;margin:0 0 9px;border-bottom:1px solid #ffffff18}
  .opr-portal-open{width:100%;display:grid;grid-template-columns:30px 1fr 16px;align-items:center;gap:8px;text-align:left;border:1px solid #ffffff1e;background:#ffffff0d;color:#fff;border-radius:11px;padding:9px 10px;cursor:pointer}
  .opr-portal-open:hover{background:#ffffff16;border-color:#ffffff2d}.opr-portal-open:focus-visible{outline:2px solid #fff;outline-offset:2px}
  .opr-portal-icon{width:28px;height:28px;border-radius:8px;background:#ffffff12;display:grid;place-items:center;font-size:12px}.opr-portal-open b{display:block;font-size:10.5px}.opr-portal-open small{display:block;color:#bfc4cf;font-size:8.5px;margin-top:1px}.opr-portal-chevron{font-size:20px;color:#b88b78;text-align:right}
  .opr-portal-backdrop{position:fixed;inset:0;background:#0b1220a8;backdrop-filter:blur(2px);z-index:998}.opr-portal-backdrop[hidden]{display:none}
  .opr-portal-drawer{position:fixed;left:0;top:0;bottom:0;width:min(390px,92vw);background:linear-gradient(180deg,#111827,#0b1220);color:#fff;z-index:999;box-shadow:24px 0 70px #0005;transform:translateX(-105%);transition:transform .2s ease;overflow:auto;padding:18px}.opr-portal-drawer.open{transform:translateX(0)}
  .opr-portal-drawer-head{display:flex;justify-content:space-between;gap:15px;align-items:flex-start;padding:4px 4px 16px;border-bottom:1px solid #ffffff14}.opr-portal-drawer-head span{font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:900}.opr-portal-drawer-head h2{margin:4px 0 2px;font-size:20px}.opr-portal-drawer-head p{margin:0;color:#94a3b8;font-size:9.5px}.opr-portal-close{border:0;background:#ffffff10;color:#fff;width:34px;height:34px;border-radius:10px;font-size:22px;cursor:pointer}.opr-portal-close:hover{background:#ffffff1b}
  .opr-portal-groups section{margin-top:15px}.opr-portal-groups h3{font-size:8px;text-transform:uppercase;letter-spacing:1.25px;color:#64748b;margin:0 0 6px;padding:0 4px}.opr-portal-groups a{display:flex;justify-content:space-between;align-items:center;gap:10px;text-decoration:none;color:#cbd5e1;border-radius:10px;padding:9px 10px;font-size:10px;font-weight:800;margin:2px 0}.opr-portal-groups a:hover{background:#ffffff0d;color:#fff}.opr-portal-groups a.is-current{background:#fff;color:#111827}.opr-portal-groups a em{font-style:normal;font-size:7.5px;text-transform:uppercase;letter-spacing:.7px;color:#0f6fff;background:#e8f1ff;border-radius:99px;padding:3px 6px}
  .opr-portal-drawer-foot{margin-top:18px;padding:12px;border:1px solid #ffffff14;border-radius:12px;color:#94a3b8;font-size:8.8px;line-height:1.45}.opr-portal-drawer-foot b{display:block;color:#fff;font-size:9px;margin-bottom:3px}.opr-portal-drawer-foot span{display:block}
  body.opr-portal-drawer-open{overflow:hidden}
  @media(max-width:980px){.opr-portal-launcher{flex:0 0 auto;min-width:190px;border-bottom:0;margin:0;padding:0}.opr-portal-open{height:40px}.opr-portal-open small{display:none}}
  @media print{.opr-portal-launcher,.opr-portal-backdrop,.opr-portal-drawer{display:none!important}}
  `;
  document.head.appendChild(st);

  const openBtn=launcher.querySelector('.opr-portal-open'),closeBtn=drawer.querySelector('.opr-portal-close');
  function setOpen(on){drawer.classList.toggle('open',on);drawer.setAttribute('aria-hidden',String(!on));backdrop.hidden=!on;openBtn.setAttribute('aria-expanded',String(on));document.body.classList.toggle('opr-portal-drawer-open',on);if(on)closeBtn.focus();else openBtn.focus()}
  openBtn.addEventListener('click',()=>setOpen(true));closeBtn.addEventListener('click',()=>setOpen(false));backdrop.addEventListener('click',()=>setOpen(false));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&drawer.classList.contains('open'))setOpen(false)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
