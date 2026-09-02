import fs from 'node:fs';
const workerFile='public/_worker.js';
const popApiFile='src/opr-pop-api.js';
const versionApiFile='src/opr-pop-versioning-api.js';
const popStart='    // BEGIN ALLAMO OPR POP API',popEnd='    // END ALLAMO OPR POP API';
const verStart='    // BEGIN ALLAMO OPR POP VERSIONING API',verEnd='    // END ALLAMO OPR POP VERSIONING API';
const pmoNeedle='    // BEGIN ALLAMO OPR PMO API';
function sync(text,start,end,content,needle,indent=''){
  const block=start+'\n'+content.split('\n').map(x=>indent+x).join('\n')+'\n'+end;
  if(text.includes(start)){const a=text.indexOf(start),b=text.indexOf(end,a);if(b<0)throw new Error('Marcador final ausente: '+end);return text.slice(0,a)+block+text.slice(b+end.length)}
  if(!text.includes(needle))throw new Error('Ponto de injeção OPR não encontrado: '+needle);
  return text.replace(needle,block+'\n'+needle);
}
let worker=fs.readFileSync(workerFile,'utf8');
worker=sync(worker,popStart,popEnd,fs.readFileSync(popApiFile,'utf8'),pmoNeedle,'    ');
worker=sync(worker,verStart,verEnd,fs.readFileSync(versionApiFile,'utf8'),popStart,'    ');
if((worker.match(/BEGIN ALLAMO OPR POP API/g)||[]).length!==1)throw new Error('Bloco POP OPR duplicado.');
if((worker.match(/BEGIN ALLAMO OPR POP VERSIONING API/g)||[]).length!==1)throw new Error('Bloco de versionamento POP duplicado.');
if(worker.indexOf(verStart)>worker.indexOf(popStart)||worker.indexOf(popStart)>worker.indexOf(pmoNeedle))throw new Error('Ordem das APIs OPR POP inválida.');
fs.writeFileSync(workerFile,worker);

const page='public/opr-pop/index.html';
if(fs.existsSync(page)){
  let html=fs.readFileSync(page,'utf8');
  if(!html.includes('data-opr-platform-links="1"')){
    const old='<a class="btn" href="/opr-plano-de-acao/">Plano de Ação</a>';
    if(!html.includes(old))throw new Error('Atalho do Plano não localizado no POP');
    const links='<span data-opr-platform-links="1"></span><a class="btn" href="/opr-plano-de-acao/">Plano de Ação</a><a class="btn" href="/opr-status-report/">Status Report</a><a class="btn" href="/opr-mapa-implantacao/">Mapa Mestre</a><button class="btn" onclick="openPopVersions()">Versões</button>';
    html=html.replace(old,links);
  }
  if(!html.includes('data-opr-pop-current-version="1"')){
    const stateOld="const state={projects:[],project:'',config:null,procedures:[],trash:[],editing:null};";
    if(!html.includes(stateOld))throw new Error('State do POP não localizado para versionamento');
    html=html.replace(stateOld,"const state={projects:[],project:'',config:null,currentVersion:null,procedures:[],trash:[],editing:null};const OPR_POP_VERSIONED=1;");
    const loadOld="state.config=d.config;state.procedures=d.procedures;el('brandProject').textContent=d.project?.name||'Projeto OPR';";
    if(!html.includes(loadOld))throw new Error('Load do POP não localizado para versão corrente');
    html=html.replace(loadOld,"state.config=d.config;state.procedures=d.procedures;try{const vv=await api('opr-pop-versions?project='+encodeURIComponent(state.project));state.currentVersion=vv.current||null}catch{state.currentVersion=null}el('brandProject').textContent=d.project?.name||'Projeto OPR';");
    const metaOld="<div><b>Versão</b>${esc(c.version||'1.0')}</div>";
    if(!html.includes(metaOld))throw new Error('Meta de versão do POP não localizada');
    html=html.replace(metaOld,"<div data-opr-pop-current-version=\"1\"><b>Versão documental</b>${esc(state.currentVersion?.version_label||('v'+(c.version||'1.0')))}</div>");
  }
  if(!html.includes('id="versionsModal"')){
    const modal='<div class="modal" id="versionsModal"><div class="modalbox wide"><h3>Versões documentais do POP</h3><div id="currentPopVersion" class="smallnote"></div><div class="card tablewrap"><table><thead><tr><th>Versão</th><th>Evento</th><th>Motivo</th><th>Responsável</th><th>Data</th><th></th></tr></thead><tbody id="versionRows"></tbody></table></div><div class="modal-actions"><button class="btn" onclick="closeModal(\'versionsModal\')">Fechar</button></div></div></div><div class="modal" id="versionSnapshotModal"><div class="modalbox wide"><h3 id="versionSnapshotTitle">Snapshot do POP</h3><pre id="versionSnapshotBody" style="white-space:pre-wrap;word-break:break-word;background:#faf9f7;border-radius:10px;padding:12px;font-size:9px;max-height:65vh;overflow:auto"></pre><div class="modal-actions"><button class="btn" onclick="closeModal(\'versionSnapshotModal\')">Fechar</button></div></div></div>';
    html=html.replace('<script>',modal+'<script>');
    const funcs=[
      '',
      "async function openPopVersions(){try{",
      "const d=await api('opr-pop-versions?project='+encodeURIComponent(state.project)),rows=d.versions||[];",
      "state.currentVersion=d.current||null;renderMeta();",
      "el('currentPopVersion').textContent=d.current?'Versão atual: '+d.current.version_label+' · '+(d.current.document_status||'A confirmar'):'Sem versão documental registrada.';",
      "el('versionRows').innerHTML=rows.map(v=>'<tr><td><b>'+esc(v.version_label)+'</b></td><td>'+esc(v.event_type)+'</td><td>'+esc(v.reason||'Não informado')+'</td><td>'+esc(v.actor||'PENDENTE DE VALIDAÇÃO')+'</td><td>'+esc(v.created_at||'')+'</td><td><button class=\"btn\" data-version-id=\"'+esc(v.id)+'\" onclick=\"openPopVersionSnapshot(this.dataset.versionId)\">Abrir</button></td></tr>').join('')||'<tr><td colspan=\"6\" class=\"empty\">Sem versões registradas.</td></tr>';",
      "openModal('versionsModal')}catch(e){showError(e)}}",
      "async function openPopVersionSnapshot(id){try{const v=await api('opr-pop-versions/'+encodeURIComponent(id));el('versionSnapshotTitle').textContent='Snapshot · '+(v.version_label||id);el('versionSnapshotBody').textContent=pretty(v.content_json);openModal('versionSnapshotModal')}catch(e){showError(e)}}",
      ''
    ].join('\n');
    const at=html.lastIndexOf('</script>');if(at<0)throw new Error('Script do POP não localizado');html=html.slice(0,at)+funcs+html.slice(at);
  }
  fs.writeFileSync(page,html);
}
console.log('OK: POP OPR persistente, versão corrente no cabeçalho, histórico imutável e quatro links oficiais.');
