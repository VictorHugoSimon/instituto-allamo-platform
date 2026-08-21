(()=>{
  if(window.__allamoRaciVisualLoaded)return;
  window.__allamoRaciVisualLoaded=true;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const role=v=>{const x=String(v||'').trim().toUpperCase();return ['R','A','C','I'].includes(x)?x:''};
  const chip=r=>r?`<span class="allamo-raci-chip allamo-raci-${r.toLowerCase()}" title="${{R:'Responsável',A:'Accountable / Aprovador',C:'Consultado',I:'Informado'}[r]}">${r}</span>`:'—';
  const legend=()=>`<div class="allamo-raci-legend"><span>${chip('R')} Responsável</span><span>${chip('A')} Accountable/Aprovador</span><span>${chip('C')} Consultado</span><span>${chip('I')} Informado</span></div>`;
  function parse(raw){
    const lines=String(raw||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!lines.length)return null;
    const pipe=lines.filter(x=>x.includes('|')).map(x=>x.split('|').map(y=>y.trim()).filter((y,i,a)=>!(i===0&&y==='')&&!(i===a.length-1&&y==='')));
    if(pipe.length>=2){let rows=pipe.filter(r=>!r.every(c=>/^[-: ]+$/.test(c)));if(rows.length<2)return null;const headers=rows[0],body=rows.slice(1);if(headers.length<2)return null;return {headers,rows:body}}
    const semi=lines.map(x=>x.split(/[;·]/).map(y=>y.trim()).filter(Boolean));if(semi.length>=2&&semi.some(r=>r.some(c=>role(c)))){const max=Math.max(...semi.map(r=>r.length));const headers=['Atividade',...Array.from({length:max-1},(_,i)=>`Papel ${i+1}`)];return {headers,rows:semi}}
    return null;
  }
  function table(data){return `<div class="allamo-raci-wrap"><table class="allamo-raci-table"><thead><tr>${data.headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${data.rows.map(r=>`<tr>${data.headers.map((_,i)=>i===0?`<td>${esc(r[i]||'')}</td>`:`<td>${chip(role(r[i]))}${role(r[i])?'':esc(r[i]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
  function preview(raw){const data=parse(raw);return `<div class="allamo-raci-title"><span>Visualização RACI</span><span style="font-size:11px;color:#667085;font-weight:600">Mapa de responsabilidade</span></div>${legend()}${data?table(data):'<div style="font-size:12px;color:#667085;padding:8px 0">Para gerar o gráfico, use uma linha por atividade e separe as colunas por <b>|</b>. Ex.: <code>Atividade | PMO | Dual | TOTVS</code>.</div>'}`}
  function enhanceEditor(){
    const form=[...document.querySelectorAll('h1,h2,h3')].find(x=>/editar status report/i.test(x.textContent||''))?.closest('form');if(!form)return;
    [...form.querySelectorAll('label')].forEach(l=>{const t=norm(l.textContent);if(!t.startsWith('matriz raci'))return;const input=l.querySelector('textarea,input')||l.parentElement?.querySelector('textarea,input');if(!input)return;let box=l.parentElement?.querySelector('[data-allamo-raci-visual]');if(!box){box=document.createElement('div');box.setAttribute('data-allamo-raci-visual','editor');box.className='allamo-raci-preview';(input.parentElement||l).insertAdjacentElement('afterend',box)}const render=()=>box.innerHTML=preview(input.value);if(!input.dataset.raciBound){input.dataset.raciBound='1';input.addEventListener('input',render);input.addEventListener('change',render)}render()})
  }
  function enhanceReadOnly(){
    [...document.querySelectorAll('h2,h3,h4,strong')].forEach(h=>{if(norm(h.textContent)!=='matriz raci')return;if(h.closest('form'))return;const host=h.parentElement;if(!host||host.querySelector('[data-allamo-raci-visual]'))return;let raw='';for(const x of [...host.querySelectorAll('p,pre,div')]){if(x===h||x.children.length>3)continue;const tx=(x.innerText||x.textContent||'').trim();if(tx&&tx!==h.textContent&&tx.length>2){raw=tx;break}}const box=document.createElement('div');box.setAttribute('data-allamo-raci-visual','viewer');box.className='allamo-raci-preview';box.innerHTML=preview(raw);host.appendChild(box)})
  }
  function tick(){try{enhanceEditor();enhanceReadOnly()}catch(e){console.warn('[raci-visual]',e)}}
  tick();setInterval(tick,650);window.addEventListener('allamo:data-changed',tick);
})();
