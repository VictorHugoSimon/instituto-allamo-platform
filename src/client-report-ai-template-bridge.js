(()=>{
  if(window.__allamoClientReportAiTemplateBridge)return;
  window.__allamoClientReportAiTemplateBridge=true;
  const original=window.fetch.bind(window);
  const safeClone=v=>{try{return JSON.parse(JSON.stringify(v))}catch(_){return v}};
  const asArray=v=>Array.isArray(v)?v:[];
  const pathOf=input=>{try{return new URL(String((input&&input.url)||input||''),location.href).pathname}catch(_){return ''}};
  const methodOf=(input,init)=>String(init?.method||input?.method||'GET').toUpperCase();
  const tone=v=>/alto|crít|crit|vermelho/i.test(String(v||''))?'red':/m[eé]dio|aten|amarelo/i.test(String(v||''))?'amber':'blue';
  const statusLabel=v=>({VERDE:'VERDE',AMARELO:'ATENÇÃO',VERMELHO:'CRÍTICO',A_CONFIRMAR:'A CONFIRMAR'}[String(v||'').toUpperCase()]||String(v||'ATENÇÃO'));
  const horizon=due=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(due||'')))return '15 dias';const days=Math.ceil((new Date(due+'T12:00:00').getTime()-Date.now())/86400000);return days<=7?'7 dias':'15 dias'};
  const enrich=(data,result)=>{
    if(!data||typeof data!=='object'||!result||typeof result!=='object')return data;
    const out=safeClone(data),previous=out.client_template&&typeof out.client_template==='object'?out.client_template:{};
    const risks=asArray(result.risks),actions=asArray(result.actions),decisions=asArray(result.decisions),road=asArray(result.roadmap_updates),warnings=asArray(result.warnings),unsupported=asArray(result.quantitative_fields_without_evidence),sources=asArray(result.sources_used);
    const tpl={...previous,template_id:'ALLAMO_EXECUTIVE_CLIENT_V1',overall_status:statusLabel(result.overall_status),status_note:result.executive_summary_suggestion||previous.status_note||''};
    if(risks.length)tpl.attentions=risks.map(x=>({flag:x.impact||'Atenção',tone:tone(x.impact),title:x.risk||'Risco',text:x.mitigation||'',owner:x.owner||'A confirmar',source:x.source_name||'',confidence:x.confidence||''}));
    if(actions.length){
      tpl.actions=actions.map(x=>({action:x.title||'Ação',owner:x.responsible||'A confirmar',start:'',due:x.due_date||'A confirmar',status:'Pendente de validação',dependency:x.description||'',impact:'',responsible_party:x.responsible_party||'A_CONFIRMAR',source:x.source_name||'',confidence:x.confidence||''}));
      tpl.client_dependencies=actions.filter(x=>x.responsible_party==='CLIENTE').map(x=>({pending:x.title||'Dependência do cliente',owner:x.responsible||'A confirmar',impact:x.description||'',due:x.due_date||'A confirmar',source:x.source_name||''}));
      tpl.next=actions.map(x=>({horizon:horizon(x.due_date),action:x.title||'Ação',owner:x.responsible||'A confirmar',due:x.due_date||'A confirmar',source:x.source_name||'',confidence:x.confidence||''}));
    }
    if(decisions.length)tpl.decisions=decisions.map(x=>({title:x.decision||'Decisão',text:x.impact||'',owner:x.owner||'A confirmar',date:x.date||'',source:x.source_name||'',confidence:x.confidence||''}));
    if(road.length){
      tpl.roadmap=road.map(x=>({name:x.title||'Marco',status:x.status||'A_CONFIRMAR',date:x.due_date||x.start_date||'A confirmar',start_date:x.start_date||'',due_date:x.due_date||'',responsible:x.responsible||'A confirmar',responsible_party:x.responsible_party||'A_CONFIRMAR',description:x.description||'',source:x.source_name||'',confidence:x.confidence||''}));
      tpl.critical_path=road.filter(x=>['BLOQUEADO','EM ANDAMENTO','A_CONFIRMAR'].includes(String(x.status||'').toUpperCase())).map(x=>({activity:x.title||'Marco',status:x.status||'A_CONFIRMAR',owner:x.responsible||'A confirmar',dependency:x.description||'',date:x.due_date||'A confirmar',source:x.source_name||''}));
    }
    if(sources.length)tpl.sources=sources;
    const validation=[...warnings,...unsupported.map(x=>'Campo quantitativo sem evidência suficiente: '+x)].filter(Boolean);
    if(validation.length)tpl.validation_note=validation.join(' · ');
    tpl.ai_run_id=result.run_id||result.id||window.__allamoLastReportAiRunId||'';
    tpl.ai_approved_at=new Date().toISOString();
    out.client_template=tpl;
    return out;
  };
  window.fetch=async function(input,init={}){
    const path=pathOf(input),method=methodOf(input,init);
    let next=init;
    if(path==='/api/report'&&method==='POST'){
      try{
        const payload=JSON.parse(init.body||'{}');
        if(String(payload?.source||'').toUpperCase()==='AI'&&window.__allamoLastReportAiResult){
          const data=payload?.data&&typeof payload.data==='object'?payload.data:payload;
          const enriched=enrich(data,window.__allamoLastReportAiResult);
          const body=payload?.data?{...payload,data:enriched}:enriched;
          next={...init,body:JSON.stringify(body)};
        }
      }catch(e){console.warn('[client-report-template] não foi possível enriquecer o save da IA',e)}
    }
    const response=await original(input,next);
    if(path==='/api/report-ai'&&method==='POST'&&response.ok){
      try{
        const result=await response.clone().json();
        window.__allamoLastReportAiResult=result;
        window.__allamoLastReportAiRunId=result?.run_id||result?.id||'';
      }catch(e){console.warn('[client-report-template] resposta da IA não pôde ser armazenada',e)}
    }
    return response;
  };
  window.AllamoClientReportAiTemplateBridge={enrich};
})();
