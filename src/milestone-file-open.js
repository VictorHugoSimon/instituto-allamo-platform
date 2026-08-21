(()=>{
  if(window.__allamoMilestoneFileOpenLoaded)return;window.__allamoMilestoneFileOpenLoaded=true;
  const token=()=>{try{return JSON.parse(localStorage.getItem('allamo_session')||'{}').token||''}catch(_){return ''}};
  async function openAuthenticated(url){try{const r=await fetch(url,{headers:{authorization:'Bearer '+token()},cache:'no-store'});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||'Não foi possível abrir o arquivo')}const blob=await r.blob(),u=URL.createObjectURL(blob),w=window.open(u,'_blank','noopener');if(!w)location.href=u;setTimeout(()=>URL.revokeObjectURL(u),120000)}catch(err){alert(err.message)}}
  document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-me-open-file]');if(b){e.preventDefault();e.stopImmediatePropagation();openAuthenticated('/api/project-milestone-assets/'+encodeURIComponent(b.dataset.meOpenFile)+'/content');return}const a=e.target?.closest?.('a.arrv-doc');if(!a)return;const href=a.getAttribute('href')||'';if(!href.includes('/api/project-milestone-assets/'))return;e.preventDefault();e.stopImmediatePropagation();openAuthenticated(href)},true);
})();
