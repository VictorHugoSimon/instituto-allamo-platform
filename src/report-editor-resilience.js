(()=>{
  if(window.__allamoReportEditorResilienceLoaded)return;
  window.__allamoReportEditorResilienceLoaded=true;

  const clone=v=>JSON.parse(JSON.stringify(v??{}));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const publicMode=()=>{try{return new URLSearchParams(location.search).has('cliente')}catch(_){return false}};
  const token=()=>{try{return JSON.parse(localStorage.getItem('allamo_session')||'{}').token||''}catch(_){return ''}};
  const api=async(path,opts={})=>{
    const t=token(),headers={'content-type':'application/json',...(t?{authorization:'Bearer '+t}:{}),...(opts.headers||{})};
    const r=await fetch('/api/'+path,{...opts,headers,cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||('HTTP '+r.status));
    return d;
  };
  const state=()=>window.__allamoLiveReportState||null;
  const activeReport=()=>state()?.getActive?.()||window.__allamoReportEditorResilienceActive||null;
  const draftKey=id=>'allamo_report_draft:'+String(id||'');
  const nowLabel=()=>new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const readLocal=id=>{try{return JSON.parse(sessionStorage.getItem(draftKey(id))||'null')}catch(_){return null}};
  const writeLocal=(id,payload)=>{try{sessionStorage.setItem(draftKey(id),JSON.stringify(payload));return true}catch(_){return false}};
  const clearLocal=id=>{try{sessionStorage.removeItem(draftKey(id))}catch(_){}};

  const style=document.createElement('style');
  style.textContent=`
    .alres-status{font-size:10.5px;font-weight:750;opacity:.88;padding:5px 8px;border-radius:999px;background:#ffffff1b;color:#fff;white-space:nowrap}
    .alres-status.dirty{background:#fff3cd;color:#7a4c00}.alres-status.saved{background:#e7f7ee;color:#146c43}
    .alres-recovery{display:flex;gap:9px;align-items:flex-start;flex-wrap:wrap;background:#fff8e7;border:1px solid #f0cf84;border-radius:10px;padding:10px 12px;margin-bottom:10px;color:#5e4500}
    .alres-recovery .grow{flex:1;min-width:240px}.alres-recovery button{border:0;border-radius:7px;padding:7px 9px;font-weight:800;cursor:pointer}
    .alres-history{position:fixed;inset:0;z-index:100080;background:#0009;display:flex;align-items:center;justify-content:center;padding:14px}
    .alres-history-box{width:min(1180px,97vw);max-height:94vh;background:#f7f7f5;border-radius:15px;overflow:hidden;display:flex;flex-direction:column}
    .alres-history-head{background:#302f39;color:#fff;padding:13px 15px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.alres-history-head .grow{flex:1;min-width:220px}
    .alres-history-head button,.alres-history-controls button{border:0;border-radius:8px;padding:8px 10px;font-weight:800;cursor:pointer}
    .alres-history-body{padding:14px;overflow:auto}.alres-history-controls{display:grid;grid-template-columns:1fr 1fr;gap:10px;background:#fff;border:1px solid #e4e7ec;border-radius:11px;padding:11px;margin-bottom:11px}
    .alres-history-controls label{font-size:11px;font-weight:800;color:#667085;display:block;margin-bottom:4px}.alres-history-controls select{width:100%;padding:8px;border:1px solid #d0d5dd;border-radius:8px;background:#fff}
    .alres-version-meta{font-size:11px;color:#667085;margin-top:5px}.alres-diff{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e4e7ec;font-size:11.5px}.alres-diff th,.alres-diff td{padding:8px;border-bottom:1px solid #eef1f4;text-align:left;vertical-align:top}.alres-diff th{position:sticky;top:0;background:#f8fafc;z-index:1}.alres-diff td:nth-child(2),.alres-diff td:nth-child(3){white-space:pre-wrap;word-break:break-word;max-width:360px}
    .alres-change{font-weight:850}.alres-added{color:#087a49}.alres-removed{color:#a11}.alres-changed{color:#8a5b00}
    .alres-empty{background:#fff;border:1px dashed #d0d5dd;border-radius:10px;padding:18px;text-align:center;color:#667085}
    @media(max-width:760px){.alres-history{padding:0}.alres-history-box{width:100vw;max-height:100dvh;height:100dvh;border-radius:0}.alres-history-controls{grid-template-columns:1fr}.alres-diff{font-size:10.5px}}
  `;
  (document.head||document.documentElement).appendChild(style);

  let editor=null,dirty=false,pendingCommit=false,debounce=0,editorObserver=null;
  const getDraft=()=>clone(state()?.getDraft?.()||{});
  const getReport=()=>activeReport();
  const noteValue=()=>editor?.querySelector('[data-note]')?.value||'';
  const setStatus=(text,kind='')=>{const el=editor?.querySelector('[data-alres-status]');if(!el)return;el.textContent=text;el.className='alres-status '+kind};
  const saveLocalDraft=()=>{
    const r=getReport();if(!editor||!r?.id||!dirty)return;
    const ok=writeLocal(r.id,{report_id:r.id,base_updated_at:r.updated_at||'',saved_at:new Date().toISOString(),draft:getDraft(),change_note:noteValue()});
    if(ok)setStatus('Rascunho local salvo '+nowLabel(),'saved');
  };
  const scheduleLocalSave=()=>{clearTimeout(debounce);debounce=setTimeout(saveLocalDraft,450)};
  const markDirty=()=>{if(!editor)return;dirty=true;setStatus('Alterações não salvas','dirty');scheduleLocalSave()};
  const detachEditor=()=>{clearTimeout(debounce);editorObserver?.disconnect();editorObserver=null;editor=null;dirty=false;pendingCommit=false};

  const addRecoveryBanner=(m,r)=>{
    const saved=readLocal(r.id);if(!saved?.draft)return;
    const body=m.querySelector('.alre-body');if(!body)return;
    const b=document.createElement('div');b.className='alres-recovery';
    const serverChanged=!!(saved.base_updated_at&&r.updated_at&&String(saved.base_updated_at)!==String(r.updated_at));
    b.innerHTML=`<div class="grow"><b>Rascunho local encontrado</b><div style="font-size:11px;margin-top:3px">Salvo em ${esc(new Date(saved.saved_at||Date.now()).toLocaleString('pt-BR'))}.${serverChanged?' O Report foi atualizado no servidor depois deste rascunho; revise antes de salvar.':''}</div></div><button data-alres-restore>Restaurar</button><button data-alres-discard>Descartar</button>`;
    body.prepend(b);
    b.querySelector('[data-alres-restore]').onclick=()=>{
      const st=state();if(!st?.setDraft||!st?.rerender)return alert('O editor ainda não está pronto para restaurar o rascunho.');
      st.setDraft(clone(saved.draft));st.rerender();
      const note=m.querySelector('[data-note]');if(note)note.value=saved.change_note||'';
      dirty=true;setStatus('Rascunho restaurado · revise e salve','dirty');b.remove();
    };
    b.querySelector('[data-alres-discard]').onclick=()=>{clearLocal(r.id);b.remove();setStatus('Rascunho local descartado','')};
  };

  const bindEditor=m=>{
    if(publicMode()||m.dataset.alresBound==='1')return;
    const r=getReport();if(!r?.id)return;
    m.dataset.alresBound='1';editor=m;dirty=false;pendingCommit=false;
    const head=m.querySelector('.alre-head');if(head&&!head.querySelector('[data-alres-status]')){const s=document.createElement('span');s.dataset.alresStatus='1';s.className='alres-status';s.textContent='Sem alterações';const close=head.querySelector('[data-close]');close?head.insertBefore(s,close):head.appendChild(s)}
    addRecoveryBanner(m,r);
    setTimeout(()=>{
      m.addEventListener('input',markDirty,true);m.addEventListener('change',markDirty,true);
      const tree=m.querySelector('.alre-tree');if(tree){editorObserver=new MutationObserver(()=>markDirty());editorObserver.observe(tree,{childList:true,subtree:true})}
    },120);
  };

  document.addEventListener('click',ev=>{
    const m=ev.target?.closest?.('.alre');if(!m||m!==editor)return;
    if(ev.target.closest('[data-save],[data-new]')){pendingCommit=true;setTimeout(()=>{if(editor===m&&m.isConnected)pendingCommit=false},8000);return}
    const closing=ev.target.closest('[data-close]')||ev.target===m;
    if(closing&&dirty){
      saveLocalDraft();
      const ok=confirm('Há alterações ainda não salvas no Report. Fechar agora?\n\nO rascunho local ficará disponível nesta aba para restaurar depois.');
      if(!ok){ev.preventDefault();ev.stopImmediatePropagation();return}
    }
  },true);

  window.addEventListener('beforeunload',ev=>{if(!dirty||!editor)return;saveLocalDraft();ev.preventDefault();ev.returnValue=''});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirty)saveLocalDraft()});

  const editorMountObserver=new MutationObserver(()=>{
    const m=document.querySelector('.alre');
    if(m&&m!==editor)bindEditor(m);
    if(editor&&!editor.isConnected){const r=getReport();if(pendingCommit&&r?.id)clearLocal(r.id);detachEditor()}
  });
  editorMountObserver.observe(document.body,{childList:true,subtree:true});

  const SKIP=new Set(['data_json','snapshot_json','created_at','updated_at','published_at','archived_at','updated_by','created_by']);
  const scalar=v=>v==null?'':typeof v==='string'?v:typeof v==='number'||typeof v==='boolean'?String(v):JSON.stringify(v);
  const pathLabel=p=>String(p||'').replace(/^report\./,'').replace(/^data\./,'').replace(/\.(\d+)(?=\.|$)/g,' [$1]').replace(/_/g,' ').replace(/\./g,' › ').replace(/\b\w/g,m=>m.toUpperCase());
  const itemKey=(v,i)=>{if(v&&typeof v==='object'){const k=v.id||v.title||v.name||v.label||v.fase||v.etapa||v.risco;return k?String(k):String(i+1)}return String(i+1)};
  function flatten(v,path='',out={}){
    if(Array.isArray(v)){v.forEach((x,i)=>flatten(x,path+'['+itemKey(x,i)+']',out));if(!v.length)out[path]='[]';return out}
    if(v&&typeof v==='object'){
      for(const [k,x] of Object.entries(v)){if(SKIP.has(k))continue;const next=path?path+'.'+k:k;flatten(x,next,out)}
      return out;
    }
    if(path)out[path]=scalar(v);return out;
  }
  const snapshotPayload=v=>({report:{title:v?.snapshot?.report?.title||'',reference:v?.snapshot?.report?.reference||'',status:v?.snapshot?.report?.status||'',executive_summary:v?.snapshot?.report?.executive_summary||'',data:v?.snapshot?.report?.data||{}},roadmap:v?.snapshot?.roadmap||[]});
  const shorten=v=>{const s=String(v??'');return s.length>320?s.slice(0,317)+'…':s};
  function diffVersions(a,b){const A=flatten(snapshotPayload(a)),B=flatten(snapshotPayload(b)),keys=[...new Set([...Object.keys(A),...Object.keys(B)])].sort();return keys.flatMap(k=>{if(A[k]===B[k])return[];const type=!(k in A)?'added':!(k in B)?'removed':'changed';return[{path:k,before:A[k]??'',after:B[k]??'',type}]})}
  const versionLabel=v=>'v'+v.version_no+' · '+String(v.change_note||'Sem nota').slice(0,55);
  const versionMeta=v=>`${esc(v.created_by||'—')} · ${esc(String(v.created_at||'').replace('T',' ').replace('Z',''))}`;

  async function openHistory(report){
    if(publicMode()||!report?.id)return;
    let rows;try{rows=await api('report-records/'+encodeURIComponent(report.id)+'/history')}catch(err){return alert('Não foi possível carregar o histórico: '+err.message)}
    if(!Array.isArray(rows)||!rows.length)return alert('Este Report ainda não possui versões registradas.');
    document.querySelector('.alres-history')?.remove();
    const m=document.createElement('div');m.className='alres-history';
    m.innerHTML=`<div class="alres-history-box"><div class="alres-history-head"><div class="grow"><b>Histórico & Comparar versões</b><div style="font-size:11px;opacity:.8">${esc(report.company?.name||'')} · ${esc(report.project?.name||'')} · ${rows.length} versão(ões)</div></div><button data-alres-close>Fechar</button></div><div class="alres-history-body"><div class="alres-history-controls"><div><label>Versão anterior (A)</label><select data-ver-a></select><div class="alres-version-meta" data-meta-a></div></div><div><label>Versão mais recente (B)</label><select data-ver-b></select><div class="alres-version-meta" data-meta-b></div></div></div><div data-alres-diff></div></div></div>`;
    document.body.appendChild(m);
    const sa=m.querySelector('[data-ver-a]'),sb=m.querySelector('[data-ver-b]');
    rows.forEach((v,i)=>{const oa=document.createElement('option'),ob=document.createElement('option');oa.value=ob.value=String(i);oa.textContent=ob.textContent=versionLabel(v);sa.appendChild(oa);sb.appendChild(ob)});
    sa.value=String(Math.min(1,rows.length-1));sb.value='0';
    const render=()=>{
      const a=rows[Number(sa.value)||0],b=rows[Number(sb.value)||0];m.querySelector('[data-meta-a]').innerHTML=versionMeta(a);m.querySelector('[data-meta-b]').innerHTML=versionMeta(b);
      const d=diffVersions(a,b),host=m.querySelector('[data-alres-diff]');
      if(!d.length){host.innerHTML='<div class="alres-empty">As versões selecionadas não possuem diferenças de conteúdo.</div>';return}
      const shown=d.slice(0,500);host.innerHTML=`<div style="font-size:11px;color:#667085;margin-bottom:7px">${d.length} alteração(ões) encontrada(s)${d.length>500?' · exibindo as primeiras 500':''}.</div><div style="overflow:auto"><table class="alres-diff"><thead><tr><th>Campo</th><th>Versão A</th><th>Versão B</th><th>Tipo</th></tr></thead><tbody>${shown.map(x=>`<tr><td><b>${esc(pathLabel(x.path))}</b></td><td>${esc(shorten(x.before))}</td><td>${esc(shorten(x.after))}</td><td class="alres-change alres-${x.type}">${x.type==='added'?'Adicionado':x.type==='removed'?'Removido':'Alterado'}</td></tr>`).join('')}</tbody></table></div>`;
    };
    sa.onchange=sb.onchange=render;render();
    m.querySelector('[data-alres-close]').onclick=()=>m.remove();m.onclick=ev=>{if(ev.target===m)m.remove()};
  }

  function enhanceViewer(report){
    if(report)window.__allamoReportEditorResilienceActive=report;
    if(publicMode()||!report?.id)return;
    const head=document.querySelector('.arrv .arrv-head');if(!head||head.querySelector('[data-report-history-compare]'))return;
    const b=document.createElement('button');b.dataset.reportHistoryCompare='1';b.textContent='⟲ Histórico & comparar';b.onclick=()=>openHistory(report);head.appendChild(b);
  }
  const patchRich=()=>{
    const rr=window.AllamoRichReport;if(!rr||rr.__resiliencePatched)return false;
    const original=rr.open;rr.open=function(report){window.__allamoReportEditorResilienceActive=report;const out=original.call(rr,report);setTimeout(()=>enhanceViewer(report),0);return out};rr.__resiliencePatched=true;return true;
  };
  if(!patchRich()){let n=0;const t=setInterval(()=>{if(patchRich()||++n>80)clearInterval(t)},50)}
  const viewerObserver=new MutationObserver(()=>{const r=activeReport();if(r)enhanceViewer(r)});viewerObserver.observe(document.body,{childList:true,subtree:true});

  window.AllamoReportHistory={open:r=>openHistory(r||activeReport()),diff:diffVersions};
})();
