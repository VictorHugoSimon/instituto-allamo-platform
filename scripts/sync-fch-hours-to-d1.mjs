import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k,...rest] = a.replace(/^--/,'').split('=');
  return [k,rest.join('=')||true];
}));
const envName = String(args.env || 'stage');
const cfg = envName === 'production' ? 'wrangler.production.toml' : 'wrangler.stage.toml';
const db = envName === 'production' ? 'allamo-pmo' : 'allamo-pmo-stage';
const csvPath = String(args.file || 'public/data/fch-hours.csv');
if (!['stage','production'].includes(envName)) throw new Error('Use --env=stage|production');

function norm(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,''); }
function esc(s){ return String(s??'').replace(/'/g,"''"); }
function parseCSV(text){
  const rows=[]; let row=[], cur='', q=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(q){ if(ch==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=ch; }
    else if(ch==='"')q=true; else if(ch===','){row.push(cur);cur='';}
    else if(ch==='\n'){row.push(cur);rows.push(row);row=[];cur='';}
    else if(ch!=='\r')cur+=ch;
  }
  if(cur!==''||row.length){row.push(cur);rows.push(row)}
  return rows;
}
function runSql(sql){
  const wrangler = process.platform === 'win32' ? 'node_modules/.bin/wrangler.cmd' : 'node_modules/.bin/wrangler';
  const p=spawnSync(wrangler,['d1','execute',db,'--remote','--config',cfg,'--command',sql,'--json'],{encoding:'utf8',env:process.env,maxBuffer:20*1024*1024});
  if(p.status!==0) throw new Error(((p.stderr||'')+'\n'+(p.stdout||'')||'wrangler falhou').slice(0,6000));
  const out=(p.stdout||'').trim();
  if(!out)return [];
  const pos=[out.indexOf('['),out.indexOf('{')].filter(x=>x>=0).sort((a,b)=>a-b)[0]??0;
  try{return JSON.parse(out.slice(pos));}catch{return []}
}
function resultRows(j){
  const a=Array.isArray(j)?j:[j];
  for(const x of a){ if(Array.isArray(x?.results)) return x.results; if(Array.isArray(x?.result?.[0]?.results)) return x.result[0].results; }
  return [];
}
const monthNames={jan:'01',fev:'02',mar:'03',abr:'04',mai:'05',jun:'06',jul:'07',ago:'08',set:'09',out:'10',nov:'11',dez:'12'};
function monthKey(label){
  const s=String(label||'').trim().toLowerCase();
  if(/^\d{4}-\d{2}$/.test(s))return s;
  const m=s.match(/^([a-zç]{3})\/(\d{2,4})$/i);
  if(m&&monthNames[norm(m[1]).slice(0,3)]){ const yy=m[2].length===2?'20'+m[2]:m[2]; return yy+'-'+monthNames[norm(m[1]).slice(0,3)]; }
  return '';
}

const raw=readFileSync(csvPath,'utf8').replace(/^\uFEFF/,'');
const rows=parseCSV(raw).filter(r=>r.some(c=>String(c||'').trim()));
if(rows.length<2)throw new Error('CSV de horas vazio');
const head=rows[0].map(norm);
const idx=k=>head.indexOf(norm(k));
const ci=idx('empresa'), pi=idx('projeto'), hi=idx('hora'), mi=idx('mes'), pei=idx('consultor');
if(ci<0||pi<0||hi<0||mi<0)throw new Error('Cabeçalho esperado: empresa,projeto,hora,mes,consultor');

const agg=new Map(); const byCompanyMonth=new Map();
for(let i=1;i<rows.length;i++){
  const r=rows[i], h=Number(String(r[hi]||'').replace(',','.'))||0; if(h<=0)continue;
  const company=String(r[ci]||'').trim(), project=String(r[pi]||'').trim(), mes=String(r[mi]||'').trim().slice(0,7), person=pei>=0?String(r[pei]||'').trim():'';
  const ck=norm(company), pk=norm(project); if(!ck||!mes)continue;
  const k=[ck,pk,mes,norm(person)].join('|');
  const a=agg.get(k)||{company_key:ck,project_key:pk,mes,pessoa:person,horas:0}; a.horas+=h; agg.set(k,a);
  const cm=ck+'|'+mes; byCompanyMonth.set(cm,(byCompanyMonth.get(cm)||0)+h);
}
const list=[...agg.values()];
console.log(`[fch] ${envName}: ${list.length} agregados de horas`);

runSql('DELETE FROM horas_import;');
for(let i=0;i<list.length;i+=80){
  const vals=list.slice(i,i+80).map(a=>`('${esc(a.company_key)}','${esc(a.project_key)}','${esc(a.mes)}','${esc(a.pessoa)}',${Number(a.horas.toFixed(4))},datetime('now'))`).join(',');
  runSql(`INSERT INTO horas_import (company_key,project_key,mes,pessoa,horas,updated_at) VALUES ${vals};`);
}
runSql(`INSERT INTO sync_state (source,last_run,detail) VALUES ('horas',datetime('now'),'${list.length} lançamentos · FCH automático') ON CONFLICT(source) DO UPDATE SET last_run=datetime('now'),detail=excluded.detail;`);

const reports=resultRows(runSql(`SELECT c.id AS company_id,c.name AS company_name,r.data_json FROM project_reports r JOIN companies c ON c.id=r.company_id;`));
let updated=0;
for(const row of reports){
  let data; try{data=JSON.parse(row.data_json||'{}')}catch{continue}
  const aliases=[norm(row.company_name),norm(row.company_id)].filter(Boolean);
  let curve=data.curve;
  if(!curve && aliases.some(a=>a==='dualclima'||a.includes('dualclima'))){
    const months=['mai/26','jun/26','jul/26','ago/26','set/26','out/26','nov/26','dez/26','jan/27','fev/27','mar/27','abr/27','mai/27'];
    curve={months,prev:months.map((_,i)=>38*(i+1)),real:months.map(()=>null)};
    data.curve=curve;
  }
  if(!curve||!Array.isArray(curve.months)||!curve.months.length)continue;
  let cum=0,hasAny=false,lastActualIdx=-1;
  const real=curve.months.map((m,i)=>{
    const mk=monthKey(m); let monthHours=0;
    for(const a of aliases) monthHours=Math.max(monthHours,Number(byCompanyMonth.get(a+'|'+mk)||0));
    if(monthHours>0){hasAny=true;lastActualIdx=i}
    cum+=monthHours;
    return hasAny?Number(cum.toFixed(2)):null;
  });
  if(!hasAny)continue;
  curve.real=real;
  data.curve=curve;
  const totalConsumed=Number(cum.toFixed(2));
  const totalPlanned=Number((curve.prev||[]).at(-1)||0);
  const idxPlan=Math.max(0,lastActualIdx);
  const plannedToDate=Number((curve.prev||[])[idxPlan]||0);
  const adherence=plannedToDate?Math.round((totalConsumed/plannedToDate)*100):0;
  if(Array.isArray(data.hourKpis)&&data.hourKpis.length>=3){
    data.hourKpis[0]={...data.hourKpis[0],value:String(totalConsumed).replace('.',','),unit:'h',note:'FCH automático',pct:totalPlanned?Math.min(100,Math.round(totalConsumed/totalPlanned*100))+'%':'0%'};
    data.hourKpis[1]={...data.hourKpis[1],value:String(adherence),unit:'%',note:'real × previsto até o último mês apontado',pct:Math.min(100,adherence)+'%'};
    data.hourKpis[2]={...data.hourKpis[2],value:String(Math.max(0,totalPlanned-totalConsumed).toFixed(2)).replace('.',','),unit:'h',note:'saldo contratual',pct:totalPlanned?Math.max(0,Math.round((totalPlanned-totalConsumed)/totalPlanned*100))+'%':'0%'};
  }
  data.hoursSource='FCH automático · Drive somente leitura';
  data.hoursUpdatedAt=new Date().toISOString();
  runSql(`UPDATE project_reports SET data_json='${esc(JSON.stringify(data))}',updated_at=datetime('now'),updated_by='FCH automático' WHERE company_id='${esc(row.company_id)}';`);
  updated++;
}
console.log(`[fch] ${envName}: ${updated} report(s) com Curva S/KPIs atualizados`);
