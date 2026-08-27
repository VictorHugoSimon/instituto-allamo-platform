(()=>{
  if(window.__allamoClientStatusBridgeLoaded)return;
  window.__allamoClientStatusBridgeLoaded=true;
  const rich=window.AllamoRichReport;
  const official=window.AllamoClientExecutiveReport;
  const fallback=window.AllamoClientStatusReport;
  const client=(official&&typeof official.renderInto==='function')?official:fallback;
  if(!rich||typeof rich.renderInto!=='function'||!client||typeof client.renderInto!=='function')return;
  const original=rich.renderInto.bind(rich);
  rich.renderInto=function(container,report){
    const publicStage=!!container?.closest?.('#allamo-public-client-portal')||container?.hasAttribute?.('data-pc-report-stage');
    if(publicStage)return client.renderInto(container,report);
    return original(container,report);
  };
  window.__allamoClientReportTemplateId=official?'ALLAMO_EXECUTIVE_CLIENT_V1':'LEGACY_CLIENT_LAYOUT';
  setTimeout(()=>{try{window.AllamoPublicClientPortal?.mount?.()}catch(_){}},0);
})();
