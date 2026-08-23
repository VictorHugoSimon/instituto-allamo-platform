(()=>{
  if(window.__allamoResponsiveUsabilityLoaded)return;
  window.__allamoResponsiveUsabilityLoaded=true;
  const STYLE_ID='allamo-responsive-usability';
  const css=`
html,body{max-width:100%;overflow-x:hidden}
*,*::before,*::after{box-sizing:border-box}
img,svg,canvas,video{max-width:100%;height:auto}
input,select,textarea,button{max-width:100%;font:inherit}
main,section,article,aside,form,div{min-width:0}
.allamo-scroll-x{width:100%;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
.allamo-responsive-modal{padding:16px!important;align-items:center!important;justify-content:center!important;overflow:hidden!important}
.allamo-responsive-modal-box{width:min(1180px,calc(100vw - 32px))!important;max-width:1180px!important;max-height:calc(100dvh - 32px)!important;overflow-y:auto!important;overflow-x:hidden!important;border-radius:16px!important;overscroll-behavior:contain}
.allamo-report-editor{width:100%!important;max-width:none!important;min-width:0!important}
.allamo-report-editor *{min-width:0}
.allamo-report-editor input,.allamo-report-editor select,.allamo-report-editor textarea{width:100%!important;max-width:100%!important}
.allamo-report-editor textarea{resize:vertical;min-height:72px}
.allamo-report-editor .allamo-form-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;width:100%!important}
.allamo-report-editor .allamo-form-actions{position:sticky!important;bottom:-1px!important;z-index:20!important;background:linear-gradient(to top,#fff 78%,rgba(255,255,255,.88))!important;padding:14px 0 4px!important;margin-top:16px!important;display:flex!important;justify-content:flex-end!important;gap:9px!important;flex-wrap:wrap!important}
.allamo-report-editor .allamo-form-actions button{min-height:42px;padding-inline:18px!important}
#arm,#awm{width:100vw!important;max-width:100vw!important;overflow-x:hidden!important}
#arm .art,#awm .awt{min-height:58px;padding:12px clamp(12px,2.2vw,24px)!important}
#arm .arc,#awm .awc{width:100%;max-width:1480px;margin:0 auto;padding:clamp(12px,2.2vw,24px)!important}
#arm .rlist,#awm .list{max-width:100%;overflow-x:auto!important;-webkit-overflow-scrolling:touch}
#arm .rrow{min-width:820px}
#arm .road{min-width:980px}
#arm .modal,#awm .modal{padding:16px!important;overflow:hidden!important}
#arm .box,#awm .box{width:min(1100px,calc(100vw - 32px))!important;max-width:1100px!important;max-height:calc(100dvh - 32px)!important;overflow:auto!important;overscroll-behavior:contain}
#arm .actions,#awm .actions{align-items:center}
#arm .tabs,#awm .awn{overflow-x:auto;white-space:nowrap;padding-bottom:3px;-webkit-overflow-scrolling:touch}
#arm .tabs .arb,#awm .awn .awb{flex:0 0 auto}
#awm .board{width:max-content;min-width:100%;overflow:visible}
#awm .awc{overflow-x:auto;-webkit-overflow-scrolling:touch}
#awm .row{min-width:820px}
#awm .awfilters{max-width:100%}
.arai{padding:16px!important;overflow:hidden!important}
.arai-box{width:min(1100px,calc(100vw - 32px))!important;max-height:calc(100dvh - 32px)!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain}
[data-allamo-raci-visual]{max-width:100%;overflow:hidden}
.allamo-raci-wrap{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #e4e7ec;border-radius:12px;background:#fff}
.allamo-raci-table{width:100%;min-width:620px;border-collapse:collapse;font-size:12px}
.allamo-raci-table th,.allamo-raci-table td{padding:9px 10px;border-bottom:1px solid #eef1f4;border-right:1px solid #eef1f4;text-align:center;vertical-align:middle}
.allamo-raci-table th:first-child,.allamo-raci-table td:first-child{text-align:left;font-weight:700;min-width:180px}
.allamo-raci-table th{background:#f8fafc;color:#475467;position:sticky;top:0;z-index:1}
.allamo-raci-chip{display:inline-grid;place-items:center;min-width:30px;height:30px;padding:0 8px;border-radius:8px;color:#fff;font-weight:900;font-size:12px}
.allamo-raci-r{background:#2563eb}.allamo-raci-a{background:#7c3aed}.allamo-raci-c{background:#d97706}.allamo-raci-i{background:#64748b}
.allamo-raci-legend{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 10px;font-size:11px;color:#667085}
.allamo-raci-legend span{display:inline-flex;align-items:center;gap:5px}
.allamo-raci-preview{margin:10px 0 16px;padding:12px;border:1px solid #e4e7ec;border-radius:12px;background:#fcfcfd}
.allamo-raci-title{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:800;color:#344054;margin-bottom:4px}
@media(max-width:1023px){
  #arm .arf,#awm .awfilters{grid-template-columns:1fr 1fr!important}
  #arm .grid,#awm .grid{grid-template-columns:1fr!important}
  .allamo-report-editor .allamo-form-grid{grid-template-columns:1fr 1fr!important}
}
@media(max-width:767px){
  body{font-size:14px}
  .allamo-responsive-modal{padding:0!important;align-items:stretch!important}
  .allamo-responsive-modal-box{width:100vw!important;max-width:100vw!important;height:100dvh!important;max-height:100dvh!important;border-radius:0!important;padding:16px!important}
  .allamo-report-editor .allamo-form-grid{grid-template-columns:1fr!important;gap:9px!important}
  .allamo-report-editor [style*="grid-template-columns"]{grid-template-columns:minmax(0,1fr)!important}
  .allamo-report-editor [style*="display:flex"]{flex-wrap:wrap!important}
  .allamo-report-editor .allamo-form-actions{margin-left:-2px!important;margin-right:-2px!important;padding:12px 2px 6px!important}
  .allamo-report-editor .allamo-form-actions button{flex:1 1 120px!important}
  #arm .art,#awm .awt{position:sticky!important;top:0!important;gap:7px!important}
  #arm .art>b,#awm .awt>b{width:100%;font-size:15px}
  #arm .art>span:not(.sp),#awm .awt>span:not(.sp){display:none}
  #arm .art .sp,#awm .awt .sp{display:none}
  #arm .art .arb,#awm .awt .awb{flex:1 1 auto;min-height:40px}
  #arm .arf,#awm .awfilters{grid-template-columns:1fr!important}
  #arm .rlist,#awm .list{border:0!important;background:transparent!important;overflow:visible!important}
  #arm .rrow,#awm .row{min-width:0!important;display:grid!important;grid-template-columns:1fr 1fr!important;margin:0 0 10px!important;padding:12px!important;border:1px solid #e4e7ec!important;border-radius:12px!important;background:#fff!important;gap:7px!important}
  #arm .rrow.rhead,#awm .row.head{display:none!important}
  #arm .rrow>div:first-child,#awm .row>*:first-child{grid-column:1/-1;font-size:14px}
  #arm .road{min-width:760px}
  #arm .modal,#awm .modal{padding:0!important;align-items:stretch!important}
  #arm .box,#awm .box{width:100vw!important;max-width:100vw!important;height:100dvh!important;max-height:100dvh!important;border-radius:0!important;padding:16px!important}
  #arm .actions .arb,#awm .actions .awb{flex:1 1 130px;min-height:40px}
  #arm .panel{padding:13px!important}
  #awm .awn{padding:9px 12px!important;flex-wrap:nowrap!important}
  #awm .board{min-width:1500px!important}
  #awm .awc{padding:12px!important}
  .arai{padding:0!important;align-items:stretch!important}
  .arai-box{width:100vw!important;max-width:100vw!important;height:100dvh!important;max-height:100dvh!important;border-radius:0!important;padding:16px!important}
  .arai-toolbar{position:sticky;bottom:-1px;background:#fff;padding:10px 0 4px;z-index:4}
  button,.arb,.ard-btn,.awb{min-height:40px}
}
@media(max-width:420px){
  #arm .rrow,#awm .row{grid-template-columns:1fr!important}
  #arm .rrow>*,#awm .row>*{grid-column:1!important}
  .allamo-report-editor{font-size:13px}
}
`;
  function ensureViewport(){let v=document.querySelector('meta[name="viewport"]');if(!v){v=document.createElement('meta');v.name='viewport';(document.head||document.documentElement).appendChild(v)}v.content='width=device-width,initial-scale=1,viewport-fit=cover'}
  function ensureStyle(){let s=document.getElementById(STYLE_ID);if(!s){s=document.createElement('style');s.id=STYLE_ID;(document.head||document.documentElement).appendChild(s)}if(s.textContent!==css)s.textContent=css}
  function nearestFixed(el){let x=el;for(let i=0;i<10&&x;i++,x=x.parentElement){try{if(getComputedStyle(x).position==='fixed')return x}catch(_){}}return null}
  function enhanceReportEditor(){const h=[...document.querySelectorAll('h1,h2,h3')].find(x=>x.textContent.trim()==='Editar Status Report');if(!h)return;const form=h.closest('form')||h.parentElement;if(!form)return;form.classList.add('allamo-report-editor');const fixed=nearestFixed(form);if(fixed){fixed.classList.add('allamo-responsive-modal');let box=form;while(box.parentElement&&box.parentElement!==fixed)box=box.parentElement;box.classList.add('allamo-responsive-modal-box')}[...form.querySelectorAll('div')].forEach(d=>{try{const cs=getComputedStyle(d);if(cs.display==='grid'&&d.querySelectorAll('input,select,textarea').length>=2)d.classList.add('allamo-form-grid')}catch(_){}});const cancel=[...form.querySelectorAll('button')].find(b=>/^cancelar$/i.test(b.textContent.trim()));const save=[...form.querySelectorAll('button')].find(b=>/^salvar$/i.test(b.textContent.trim()));const a=(cancel?.parentElement===save?.parentElement?cancel?.parentElement:(save?.parentElement||cancel?.parentElement));if(a)a.classList.add('allamo-form-actions')}
  function wrapWideTables(){[...document.querySelectorAll('table')].forEach(t=>{if(t.closest('.allamo-scroll-x'))return;const r=t.getBoundingClientRect();if(r.width>Math.max(360,window.innerWidth-24)){const w=document.createElement('div');w.className='allamo-scroll-x';t.parentNode.insertBefore(w,t);w.appendChild(t)}})}
  function removeFloatingLaunchers(){document.getElementById('awm-launcher')?.remove();document.getElementById('arm-launcher')?.remove()}
  function tick(){ensureViewport();ensureStyle();enhanceReportEditor();wrapWideTables();removeFloatingLaunchers()}
  let timer=0;const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>tick(),180)};
  const start=()=>{tick();const mo=new MutationObserver(()=>schedule());mo.observe(document.body,{childList:true,subtree:true});window.addEventListener('resize',schedule);window.addEventListener('allamo:data-changed',schedule);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()})};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
})();
