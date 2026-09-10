import fs from 'node:fs';

const file='public/index.html';
let index=fs.readFileSync(file,'utf8');
const begin='<!-- BEGIN ALLAMO WORK IMPORT UI -->';
const end='<!-- END ALLAMO WORK IMPORT UI -->';
const a=index.indexOf(begin);
const b=a>=0?index.indexOf(end,a):-1;
if(a<0||b<0)throw new Error('Bloco materializado do importador Excel não encontrado.');
let block=index.slice(a,b+end.length);

function replaceOnce(text,needle,replacement,label){
  const count=text.split(needle).length-1;
  if(count!==1)throw new Error(`Contrato inesperado para ${label}: ocorrências=${count}`);
  return text.replace(needle,replacement);
}

const marker='// [allamo-work-import-file-upload]';
if(!block.includes(marker)){
  const modalOld='<p style="color:#666">No Excel, selecione a tabela com o cabeçalho, pressione <b>Ctrl+C</b> e cole abaixo. O sistema não exige um layout fixo.</p><div class="grid">';
  const modalNew='<p style="color:#666">Selecione um arquivo <b>.xlsx, .xls, .csv ou .tsv</b> ou continue usando copiar/colar. O sistema mantém o mapeamento flexível de colunas.</p><div data-allamo-work-file-upload="1" style="border:1px dashed #cbd5e1;border-radius:10px;padding:12px;margin:10px 0 14px;background:#f8fafc"><label>Selecionar arquivo Excel</label><input id="wif" type="file" accept=".xlsx,.xls,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/tab-separated-values" style="display:block;width:100%;margin:6px 0"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><small id="wifmsg">O arquivo é lido no navegador. Nada é gravado antes de Validar/Importar.</small><button type="button" class="awb" id="wifclear" style="margin-left:auto">Limpar arquivo</button></div><div id="wishwrap" style="display:none;margin-top:10px"><label>Aba do Excel</label><select id="wish"></select></div></div><div class="grid">';
  block=replaceOnce(block,modalOld,modalNew,'área de upload do arquivo');

  const refsOld="const c=m.querySelector('#wic'),p=m.querySelector('#wip'),src=m.querySelector('#wis'),owner=m.querySelector('#wio'),text=m.querySelector('#wit'),area=m.querySelector('#wim'),validate=m.querySelector('#wiv'),importBtn=m.querySelector('#wii');";
  const refsNew="const c=m.querySelector('#wic'),p=m.querySelector('#wip'),src=m.querySelector('#wis'),owner=m.querySelector('#wio'),text=m.querySelector('#wit'),area=m.querySelector('#wim'),validate=m.querySelector('#wiv'),importBtn=m.querySelector('#wii'),fileInput=m.querySelector('#wif'),fileMsg=m.querySelector('#wifmsg'),sheetWrap=m.querySelector('#wishwrap'),sheet=m.querySelector('#wish'),fileClear=m.querySelector('#wifclear');";
  block=replaceOnce(block,refsOld,refsNew,'referências do upload');

  const stateNeedle='let parsed=[],headers=[],mapping={};';
  const helper=`${stateNeedle}
 ${marker}
 let workbook=null;
 const SHEETJS_URL='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
 const loadSheetJs=()=>new Promise((resolve,reject)=>{
   if(window.XLSX&&window.XLSX.read&&window.XLSX.utils&&window.XLSX.utils.sheet_to_json)return resolve(window.XLSX);
   let s=document.getElementById('allamo-sheetjs-0203');
   const ok=()=>window.XLSX&&window.XLSX.read?resolve(window.XLSX):reject(new Error('Leitor Excel não ficou disponível. Use copiar/colar como alternativa.'));
   if(s){if(s.dataset.loaded==='1')return ok();s.addEventListener('load',ok,{once:true});s.addEventListener('error',()=>reject(new Error('Não foi possível carregar o leitor de Excel. Use copiar/colar como alternativa.')),{once:true});return}
   s=document.createElement('script');s.id='allamo-sheetjs-0203';s.src=SHEETJS_URL;s.referrerPolicy='no-referrer';s.onload=()=>{s.dataset.loaded='1';ok()};s.onerror=()=>reject(new Error('Não foi possível carregar o leitor de Excel. Use copiar/colar como alternativa.'));document.head.appendChild(s);
 });
 const cleanCell=v=>String(v==null?'':v).replace(/\\t/g,' ').replace(/\\r?\\n/g,' ');
 const meaningfulRows=rows=>(rows||[]).filter(r=>Array.isArray(r)&&r.some(v=>String(v==null?'':v).trim()));
 const applyFileRows=(rows,label)=>{
   const clean=meaningfulRows(rows);
   if(clean.length<2)throw new Error('O arquivo precisa ter cabeçalho e pelo menos uma linha de dados.');
   if(clean.length>501)throw new Error('O arquivo possui '+(clean.length-1)+' demandas. O limite atual é 500 por importação. Divida o arquivo em lotes.');
   text.value=clean.map(r=>r.map(cleanCell).join('\\t')).join('\\n');
   fileMsg.textContent=label+' · '+(clean.length-1)+' demandas detectadas. Revise o mapeamento antes de importar.';
   m.querySelector('#wia').click();
 };
 const renderWorkbookSheet=()=>{
   if(!workbook)return;
   const name=sheet.value||workbook.SheetNames[0];
   const ws=workbook.Sheets[name];
   if(!ws)throw new Error('Aba do Excel não encontrada.');
   const rows=window.XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false,dateNF:'yyyy-mm-dd',blankrows:false});
   applyFileRows(rows,'Arquivo '+(fileInput.files&&fileInput.files[0]?fileInput.files[0].name:'Excel')+' · aba '+name);
 };
 sheet.onchange=()=>{try{renderWorkbookSheet()}catch(e){area.innerHTML='<div class="err">'+esc(e.message)+'</div>';validate.disabled=true;importBtn.disabled=true}};
 fileClear.onclick=()=>{fileInput.value='';workbook=null;sheet.innerHTML='';sheetWrap.style.display='none';fileMsg.textContent='O arquivo é lido no navegador. Nada é gravado antes de Validar/Importar.';text.value='';area.innerHTML='';validate.disabled=true;importBtn.disabled=true;delete importBtn.dataset.valid};
 fileInput.onchange=async()=>{
   const f=fileInput.files&&fileInput.files[0];if(!f)return;
   validate.disabled=true;importBtn.disabled=true;delete importBtn.dataset.valid;area.innerHTML='';fileMsg.textContent='Lendo '+f.name+'...';
   try{
     if(f.size>10*1024*1024)throw new Error('Arquivo maior que 10 MB. Reduza o arquivo antes de importar.');
     src.value=f.name;
     const ext=(f.name.split('.').pop()||'').toLowerCase();
     if(ext==='csv'||ext==='tsv'){
       workbook=null;sheet.innerHTML='';sheetWrap.style.display='none';
       applyFileRows(parseDelimited(await f.text()),'Arquivo '+f.name);
       return;
     }
     if(ext!=='xlsx'&&ext!=='xls')throw new Error('Formato não suportado. Use .xlsx, .xls, .csv ou .tsv.');
     const XLSX=await loadSheetJs();
     const data=await f.arrayBuffer();
     workbook=XLSX.read(data,{type:'array',cellDates:true});
     if(!workbook.SheetNames||!workbook.SheetNames.length)throw new Error('Nenhuma aba encontrada no arquivo Excel.');
     sheet.innerHTML=workbook.SheetNames.map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join('');
     sheetWrap.style.display=workbook.SheetNames.length>1?'block':'none';
     renderWorkbookSheet();
   }catch(e){fileMsg.textContent='Falha ao ler o arquivo.';area.innerHTML='<div class="err">'+esc(e.message||e)+'</div>';validate.disabled=true;importBtn.disabled=true;delete importBtn.dataset.valid}
 };`;
  block=replaceOnce(block,stateNeedle,helper,'lógica de leitura do arquivo');

  index=index.slice(0,a)+block+index.slice(b+end.length);
  fs.writeFileSync(file,index);
  console.log('OK: upload direto .xlsx/.xls/.csv/.tsv adicionado ao importador do Work Management.');
}else{
  console.log('OK: upload direto de arquivo já materializado no importador.');
}

const final=fs.readFileSync(file,'utf8');
for(const required of [
  marker,
  'data-allamo-work-file-upload="1"',
  'accept=".xlsx,.xls,.csv,.tsv',
  'xlsx-0.20.3/package/dist/xlsx.full.min.js',
  'sheet_to_json',
  'O arquivo é lido no navegador',
  'O limite atual é 500 por importação',
  "src.value=f.name"
]){
  if(!final.includes(required))throw new Error('Upload Excel incompleto: '+required);
}
