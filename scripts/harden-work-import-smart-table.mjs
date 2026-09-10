import fs from 'node:fs';

const file='public/index.html';
let html=fs.readFileSync(file,'utf8');
const marker='<!-- BEGIN ALLAMO WORK IMPORT SMART TABLE -->';
const endMarker='<!-- END ALLAMO WORK IMPORT SMART TABLE -->';
const importEnd='<!-- END ALLAMO WORK IMPORT UI -->';

const runtime=`${marker}
<script>
(()=>{
  if(window.__allamoWorkImportSmartTable)return;
  window.__allamoWorkImportSmartTable=true;
  const norm=s=>String(s??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const aliases={
    title:['demanda','tarefa','atividade','titulo','item','acao','assunto'],
    description:['descricao','detalhamento','detalhe','observacao','observacoes','escopo'],
    owner:['responsavel','desenvolvedor','dev','owner','executor','recurso'],
    start_date:['entrada','data entrada','inicio','data inicio','inicio previsto','start'],
    due_date:['saida','data saida','prazo','entrega','data entrega','fim','fim previsto','due date'],
    status:['status','situacao','etapa','fase'],
    priority:['prioridade','urgencia'],
    estimate_hours:['horas','estimativa horas','horas estimadas','esforco horas','estimativa'],
    story_points:['story points','pontos','sp'],
    item_type:['tipo','tipo demanda','categoria'],
    acceptance_criteria:['criterio aceite','criterios aceite','aceite','definition of done','dod'],
    blocked_reason:['bloqueio','impedimento','motivo bloqueio']
  };
  const parse=text=>{
    const src=String(text||'').replace(/\\r\\n/g,'\\n').replace(/\\r/g,'\\n');
    if(!src.trim())return[];
    const lines=src.split('\\n');
    const sample=lines.slice(0,30).join('\\n');
    const counts={"\\t":(sample.match(/\\t/g)||[]).length,';':(sample.match(/;/g)||[]).length,',':(sample.match(/,/g)||[]).length};
    const delimiter=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<src.length;i++){
      const ch=src[i];
      if(ch==='"'){if(quoted&&src[i+1]==='"'){cell+='"';i++}else quoted=!quoted;continue}
      if(!quoted&&ch===delimiter){row.push(cell);cell='';continue}
      if(!quoted&&ch==='\\n'){row.push(cell);if(row.some(v=>String(v).trim()))rows.push(row);row=[];cell='';continue}
      cell+=ch;
    }
    row.push(cell);if(row.some(v=>String(v).trim()))rows.push(row);return rows;
  };
  const mapHeader=row=>{
    const normalized=(row||[]).map(norm),map={};
    for(const key of Object.keys(aliases)){
      const list=aliases[key];
      let idx=normalized.findIndex(h=>list.includes(h));
      if(idx<0)idx=normalized.findIndex(h=>h&&list.some(a=>h.includes(a)||a.includes(h)));
      map[key]=idx;
    }
    return map;
  };
  const structuralTitle=v=>{
    const k=norm(v);
    if(!k)return true;
    if(/^(total|subtotal|resumo|resumo do cronograma|parametros|parametro|feriados|gantt)$/.test(k))return true;
    if(/^(tarefas lancadas|total de horas|dias uteis necessarios|data da ultima entrega)$/.test(k))return true;
    if(/^(data de inicio do trabalho|horas produtivas por dia|fator de dedicacao|horas efetivas por dia|horas efetivas por semana)$/.test(k))return true;
    if(k.startsWith('cronograma por capacidade de horas')||k.startsWith('preencha os parametros'))return true;
    return false;
  };
  const detect=rows=>{
    const meaningful=(rows||[]).filter(r=>Array.isArray(r)&&r.some(v=>String(v??'').trim()));
    let best=null;
    for(let i=0;i<Math.min(meaningful.length,100);i++){
      const map=mapHeader(meaningful[i]);
      const keys=Object.keys(map).filter(k=>map[k]>=0);
      if(map.title<0||keys.length<3)continue;
      const weight={title:8,owner:4,start_date:3,due_date:3,status:2,estimate_hours:2,description:1,priority:1,story_points:1,item_type:1,acceptance_criteria:1,blocked_reason:1};
      const score=keys.reduce((n,k)=>n+(weight[k]||1),0);
      if(!best||score>best.score)best={index:i,map,score};
    }
    if(!best)return{detected:false,rows:meaningful,taskCount:Math.max(meaningful.length-1,0),ignored:0,headerLine:1};
    const titleIdx=best.map.title;
    const data=[];
    for(const row of meaningful.slice(best.index+1)){
      const title=String(row[titleIdx]??'').trim();
      if(!title||structuralTitle(title))continue;
      data.push(row);
    }
    return{detected:true,rows:[meaningful[best.index],...data],taskCount:data.length,ignored:Math.max(0,meaningful.length-data.length-1),headerLine:best.index+1,score:best.score};
  };
  const tsv=rows=>rows.map(r=>(r||[]).map(v=>String(v??'').replace(/\\t/g,' ').replace(/\\r?\\n/g,' ')).join('\\t')).join('\\n');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const patch=modal=>{
    if(!modal||modal.dataset.smartExcelPatched==='1')return;
    const analyze=modal.querySelector('#wia'),text=modal.querySelector('#wit');
    if(!analyze||!text||typeof analyze.onclick!=='function')return;
    modal.dataset.smartExcelPatched='1';
    const original=analyze.onclick;
    analyze.onclick=function(ev){
      const result=detect(parse(text.value));
      if(result.detected&&result.taskCount){text.value=tsv(result.rows)}
      original.call(this,ev);
      const area=modal.querySelector('#wim');
      if(area){
        const msg=result.detected
          ?'<div data-allamo-smart-table="1" style="background:#eef7ee;border:1px solid #b7d8b7;padding:10px;border-radius:8px;margin-bottom:10px"><b>Tabela de demandas detectada automaticamente.</b> Cabeçalho na linha '+result.headerLine+' · '+result.taskCount+' demandas importáveis · '+result.ignored+' linhas de título/parâmetros/resumo ignoradas.<br><small>Apenas <b>Título/Demanda</b> é obrigatório. Responsável, datas, horas, status, prioridade, tipo, critérios de aceite e demais campos podem ficar vazios e ser preenchidos depois no Work Management.</small></div>'
          :'<div data-allamo-smart-table="1" style="background:#fff8e6;border:1px solid #ead39a;padding:10px;border-radius:8px;margin-bottom:10px"><b>Cabeçalho de demandas não identificado automaticamente.</b> Ajuste o mapeamento manualmente. Apenas Título/Demanda é obrigatório; os demais campos podem ser preenchidos depois.</div>';
        area.insertAdjacentHTML('afterbegin',msg);
      }
      const fileMsg=modal.querySelector('#wifmsg');
      if(fileMsg&&result.detected){
        const file=modal.querySelector('#wif');
        const sheet=modal.querySelector('#wish');
        fileMsg.textContent=(file&&file.files&&file.files[0]?file.files[0].name:'Excel')+(sheet&&sheet.value?' · aba '+sheet.value:'')+' · '+result.taskCount+' demandas reais detectadas; '+result.ignored+' linhas auxiliares ignoradas.';
      }
    };
    const note=document.createElement('div');
    note.dataset.allamoImportFlexible='1';
    note.style.cssText='background:#f8fafc;border:1px solid #d9e0e7;border-radius:8px;padding:9px 10px;margin:8px 0 12px;font-size:12px;color:#475467';
    note.innerHTML='<b>Importação flexível:</b> o sistema procura automaticamente a linha de cabeçalho da tabela e ignora blocos como parâmetros e resumo. Só Título/Demanda é obrigatório; campos ausentes podem ser completados depois.';
    const actions=modal.querySelector('.actions');
    if(actions&&actions.parentNode)actions.parentNode.insertBefore(note,actions);
  };
  const scan=()=>{const modal=document.getElementById('awm-import-modal');if(modal)patch(modal)};
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(scan,800);scan();
})();
</script>
${endMarker}`;

const a=html.indexOf(marker);
if(a>=0){
  const b=html.indexOf(endMarker,a);
  if(b<0)throw new Error('Marcador final do smart-table ausente.');
  html=html.slice(0,a)+runtime+html.slice(b+endMarker.length);
}else{
  const at=html.indexOf(importEnd);
  if(at<0)throw new Error('Bloco do importador Excel não encontrado para smart-table.');
  const pos=at+importEnd.length;
  html=html.slice(0,pos)+'\n'+runtime+html.slice(pos);
}

for(const required of ['data-allamo-smart-table="1"','Tabela de demandas detectada automaticamente','Apenas <b>Título/Demanda</b> é obrigatório','demandas reais detectadas','linhas auxiliares ignoradas','smartExcelPatched']){
  if(!html.includes(required))throw new Error('Smart-table do Excel incompleto: '+required);
}
fs.writeFileSync(file,html);
console.log('OK: importador Excel detecta a tabela real, ignora parâmetros/resumos e permite completar campos opcionais depois.');
