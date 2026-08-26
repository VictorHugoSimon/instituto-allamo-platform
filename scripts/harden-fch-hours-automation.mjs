import fs from 'node:fs';

const workerFile = 'public/_worker.js';
let worker = fs.readFileSync(workerFile, 'utf8');

// -----------------------------------------------------------------------------
// FCH → Portal PMO
// - a fonte FCH é somente leitura;
// - o Worker recebe apenas o CSV normalizado publicado pelo Apps Script;
// - GET /api/horas atualiza automaticamente quando a fonte estiver desatualizada;
// - Status Reports recebem as horas reais sem edição manual;
// - OPR_Madri já chega duplicado por visão (OPR e Madri) pelo coletor.
// -----------------------------------------------------------------------------

// 1) Correção crítica de casas decimais no importador.
// O CSV do Apps Script usa ponto decimal (ex.: 11.5). A implementação antiga
// removia o ponto e transformava 11.5 em 115.
const oldHoursParse = "    let hv=(row[hi]||'').toString().replace('.','').replace(',','.').replace(/[^0-9.]/g,''); const h=parseFloat(hv)||0;";
const newHoursParse = "    let hv=(row[hi]||'').toString().trim().replace(/\\s/g,'').replace(',','.').replace(/[^0-9.-]/g,''); const h=parseFloat(hv)||0;";
if (worker.includes(oldHoursParse)) worker = worker.replace(oldHoursParse, newHoursParse);
if (!worker.includes("replace(/\\s/g,'').replace(',','.').replace(/[^0-9.-]/g,'')")) {
  throw new Error('Parser decimal de horas não foi corrigido.');
}

// 2) Helpers de sincronização automática + enriquecimento do Status Report.
const syncMarker = 'async function syncLinear(env) {';
if (!worker.includes('async function enrichReportWithImportedHours(')) {
  if (!worker.includes(syncMarker)) throw new Error('Marcador syncLinear não encontrado no Worker.');

  const helpers = `
const HOURS_AUTO_SYNC_MINUTES = 10;

function dbDateMs_(value){
  if(!value) return 0;
  const raw=String(value).trim();
  const iso=/Z$|[+-]\\d\\d:\\d\\d$/.test(raw)?raw:raw.replace(' ','T')+'Z';
  const ms=Date.parse(iso);
  return Number.isFinite(ms)?ms:0;
}

async function syncHorasIfStale(env, maxAgeMinutes=HOURS_AUTO_SYNC_MINUTES){
  if(!env.HORAS_CSV_URL) return {ok:false, skipped:true, reason:'HORAS_CSV_URL não configurada'};
  let state=null;
  try{ state=await env.DB.prepare("SELECT last_run,detail FROM sync_state WHERE source='horas'").first(); }catch(e){}
  const age=state&&state.last_run ? Date.now()-dbDateMs_(state.last_run) : Number.POSITIVE_INFINITY;
  if(age <= maxAgeMinutes*60*1000) return {ok:true, skipped:true, last_run:state.last_run, detail:state.detail||''};
  const r=await importHoras(env);
  return {...r, skipped:false};
}

function monthShortPt_(ym){
  const m=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const mt=String(ym||'').match(/^(\\d{4})-(\\d{2})$/);
  if(!mt) return String(ym||'');
  return m[Math.max(0,Math.min(11,Number(mt[2])-1))]+'/'+mt[1].slice(2);
}

function canonicalCurveMonth_(label, availableMonths){
  const raw=String(label||'').trim().toLowerCase();
  if(/^\\d{4}-\\d{2}$/.test(raw)) return raw;
  const names={jan:'01',fev:'02',mar:'03',abr:'04',mai:'05',jun:'06',jul:'07',ago:'08',set:'09',out:'10',nov:'11',dez:'12'};
  const named=raw.match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(?:[\\/\\-](\\d{2,4}))?$/);
  if(!named) return '';
  if(named[2]){
    const year=named[2].length===2?'20'+named[2]:named[2];
    return year+'-'+names[named[1]];
  }
  const candidates=(availableMonths||[]).filter(x=>String(x).slice(5,7)===names[named[1]]);
  return candidates.length ? candidates[candidates.length-1] : '';
}

async function importedHourRowsForCompany_(env, companyId, companyName){
  const keys=[norm(companyId),norm(companyName)].filter(Boolean);
  const uniq=[...new Set(keys)];
  if(!uniq.length) return [];
  const ph=uniq.map(()=>'?').join(',');
  const sql='SELECT mes, SUM(horas) AS horas FROM horas_import WHERE company_key IN ('+ph+') GROUP BY mes ORDER BY mes';
  try{ return (await env.DB.prepare(sql).bind(...uniq).all()).results||[]; }catch(e){ return []; }
}

async function enrichReportWithImportedHours(env, data, companyId, companyName){
  try{ await syncHorasIfStale(env); }catch(e){ console.warn('[horas] sync automática falhou', String(e)); }

  const rows=await importedHourRowsForCompany_(env, companyId, companyName);
  if(!rows.length) return data;

  const out=JSON.parse(JSON.stringify(data||{}));
  const monthly=rows
    .filter(r=>r&&r.mes)
    .map(r=>({mes:String(r.mes),horas:Number(r.horas||0)}))
    .sort((a,b)=>a.mes.localeCompare(b.mes));
  if(!monthly.length) return out;

  const total=monthly.reduce((s,r)=>s+r.horas,0);
  out.hoursDataSource='FCH';
  out.hoursBars=monthly.map(r=>({month:monthShortPt_(r.mes),value:(Math.round(r.horas*100)/100).toFixed(2).replace('.',','),h:'0%'}));

  const kpis=Array.isArray(out.hourKpis)?out.hourKpis.slice():[];
  while(kpis.length<4) kpis.push({label:'',value:'—',unit:'',note:'',pct:'0%',barColor:'#2a78d6'});
  kpis[0]={...kpis[0],label:kpis[0].label||'Horas consumidas',value:(Math.round(total*100)/100).toFixed(2).replace('.',','),unit:'h',note:'FCH · atualização automática'};

  // Curva S: o Realizado passa a vir do FCH. O Planejado continua sendo a
  // baseline já registrada no report; nunca inventamos baseline contratual.
  if(out.curve && Array.isArray(out.curve.months)){
    const monthMap=Object.fromEntries(monthly.map(r=>[r.mes,r.horas]));
    const available=monthly.map(r=>r.mes);
    const latest=available[available.length-1];
    let cumulative=0;
    const real=[];
    out.curve.months.forEach(label=>{
      const key=canonicalCurveMonth_(label,available);
      if(key && key<=latest){ cumulative += Number(monthMap[key]||0); real.push(Math.round(cumulative*100)/100); }
      else real.push(null);
    });
    out.curve.real=real;
    const maxActual=Math.max(0,...real.filter(v=>v!=null).map(Number));
    const maxPlan=Math.max(0,...(out.curve.prev||[]).map(v=>Number(v)||0));
    out.curve.max=Math.max(Number(out.curve.max)||0,maxActual,maxPlan,1);

    const lastActualIndex=real.reduce((idx,v,i)=>v!=null?i:idx,-1);
    const plannedAtActual=lastActualIndex>=0 ? Number((out.curve.prev||[])[lastActualIndex]||0) : 0;
    if(plannedAtActual>0){
      const adherence=(total/plannedAtActual)*100;
      kpis[1]={...kpis[1],label:kpis[1].label||'Aderência ao plano',value:String(Math.round(adherence)),unit:'%',note:'real acumulado × baseline',pct:Math.min(100,Math.max(0,adherence)).toFixed(0)+'%'};
    }else{
      kpis[1]={...kpis[1],label:kpis[1].label||'Aderência ao plano',value:'—',unit:'',note:'baseline planejada ainda não configurada',pct:'0%'};
    }

    const contractTotal=Number(out.hoursContractTotal||0) || maxPlan;
    if(contractTotal>0){
      const saldo=contractTotal-total;
      kpis[2]={...kpis[2],label:kpis[2].label||'Saldo de horas',value:(Math.round(saldo*100)/100).toFixed(2).replace('.',','),unit:'h',note:'baseline total − realizado'};
    }
  }

  out.hourKpis=kpis;
  return out;
}

`;
  worker = worker.replace(syncMarker, helpers + syncMarker);
}

if (!worker.includes('async function enrichReportWithImportedHours(') || !worker.includes('syncHorasIfStale')) {
  throw new Error('Helpers automáticos de horas não foram aplicados.');
}

// 3) GET /api/horas faz refresh automático (cache de 10 min) antes de responder.
const oldHorasGet = `    if (path === 'horas' && request.method === 'GET') {
      const rows = await DB.prepare('SELECT company_key, project_key, mes, SUM(horas) AS horas FROM horas_import GROUP BY company_key, project_key, mes').all();
      return json(rows.results || []);
    }`;
const newHorasGet = `    if (path === 'horas' && request.method === 'GET') {
      try{ await syncHorasIfStale(env); }catch(e){ console.warn('[horas] refresh GET falhou', String(e)); }
      const rows = await DB.prepare('SELECT company_key, project_key, mes, SUM(horas) AS horas FROM horas_import GROUP BY company_key, project_key, mes ORDER BY mes, company_key').all();
      return json(rows.results || []);
    }`;
if (worker.includes(oldHorasGet)) worker = worker.replace(oldHorasGet, newHorasGet);
if (!worker.includes("refresh GET falhou")) throw new Error('GET /api/horas não recebeu refresh automático.');

// 4) Report público: injeta horas reais antes de devolver ao cliente.
const publicNeedle = `      let data; if (row && row.data_json) { try { data = JSON.parse(row.data_json); } catch(e){ data = defaultReport(co); } } else { data = defaultReport(co); }
      const gmuds =`;
const publicReplacement = `      let data; if (row && row.data_json) { try { data = JSON.parse(row.data_json); } catch(e){ data = defaultReport(co); } } else { data = defaultReport(co); }
      data = await enrichReportWithImportedHours(env, data, co.id, co.name);
      const gmuds =`;
if (worker.includes(publicNeedle)) worker = worker.replace(publicNeedle, publicReplacement);

// 5) Report de projeto salvo: atualiza Realizado do FCH em tempo de leitura.
const projectSavedNeedle = `          let data; try { data = JSON.parse(rowp.data_json); } catch (e) { data = defaultReport(co); }
          return json({ data, meta: { ref: rowp.ref, updated_at: rowp.updated_at, updated_by: rowp.updated_by, provisioned: true } });`;
const projectSavedReplacement = `          let data; try { data = JSON.parse(rowp.data_json); } catch (e) { data = defaultReport(co); }
          data = await enrichReportWithImportedHours(env, data, proj.company_id||'', co&&co.name);
          return json({ data, meta: { ref: rowp.ref, updated_at: rowp.updated_at, updated_by: rowp.updated_by, provisioned: true } });`;
if (worker.includes(projectSavedNeedle)) worker = worker.replace(projectSavedNeedle, projectSavedReplacement);

const projectBaseNeedle = `        const base = defaultReport(co); base.title = 'Governança da Implantação · ' + proj.name; base.client = (co?co.name:'') ;
        return json({ data: base, meta: { provisioned: false } });`;
const projectBaseReplacement = `        let base = defaultReport(co); base.title = 'Governança da Implantação · ' + proj.name; base.client = (co?co.name:'') ;
        base = await enrichReportWithImportedHours(env, base, proj.company_id||'', co&&co.name);
        return json({ data: base, meta: { provisioned: false } });`;
if (worker.includes(projectBaseNeedle)) worker = worker.replace(projectBaseNeedle, projectBaseReplacement);

// 6) Report de empresa salvo / novo.
const companySavedNeedle = `        let data; try { data = JSON.parse(row.data_json); } catch (e) { data = defaultReport(co); }
        return json({ data, meta: { ref: row.ref, updated_at: row.updated_at, updated_by: row.updated_by, provisioned: true } });`;
const companySavedReplacement = `        let data; try { data = JSON.parse(row.data_json); } catch (e) { data = defaultReport(co); }
        data = await enrichReportWithImportedHours(env, data, co.id, co.name);
        return json({ data, meta: { ref: row.ref, updated_at: row.updated_at, updated_by: row.updated_by, provisioned: true } });`;
if (worker.includes(companySavedNeedle)) worker = worker.replace(companySavedNeedle, companySavedReplacement);

const companyBaseNeedle = `      return json({ data: defaultReport(co), meta: { provisioned: false } });`;
const companyBaseReplacement = `      let base = defaultReport(co);
      base = await enrichReportWithImportedHours(env, base, co.id, co.name);
      return json({ data: base, meta: { provisioned: false } });`;
if (worker.includes(companyBaseNeedle)) worker = worker.replace(companyBaseNeedle, companyBaseReplacement);

// 7) Curva S consolidada da Visão Executiva também usa o Realizado do FCH.
const dashParseNeedle = `        let d; try { d = JSON.parse(r.data_json); } catch(e){ continue; }
        const c = d && d.curve; if (!c || !c.months) continue;`;
const dashParseReplacement = `        let d; try { d = JSON.parse(r.data_json); } catch(e){ continue; }
        d = await enrichReportWithImportedHours(env, d, r.company_id||'', r.company_id||'');
        const c = d && d.curve; if (!c || !c.months) continue;`;
if (worker.includes(dashParseNeedle)) worker = worker.replace(dashParseNeedle, dashParseReplacement);

const required = [
  'enrichReportWithImportedHours(env, data, co.id, co.name)',
  "refresh GET falhou",
  "FCH · atualização automática",
  "baseline planejada ainda não configurada",
  "d = await enrichReportWithImportedHours(env, d, r.company_id||'', r.company_id||'')"
];
for (const needle of required) {
  if (!worker.includes(needle)) throw new Error('Automação FCH incompleta: ' + needle);
}

fs.writeFileSync(workerFile, worker);
console.log('OK: FCH somente leitura → horas automáticas → Status Report/Curva S.');
