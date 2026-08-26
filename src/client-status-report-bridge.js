(()=>{
  if(window.__allamoClientStatusBridgeLoaded)return;
  window.__allamoClientStatusBridgeLoaded=true;
  const rich=window.AllamoRichReport,client=window.AllamoClientStatusReport;
  if(!rich||typeof rich.renderInto!=='function'||!client||typeof client.renderInto!=='function')return;
  const original=rich.renderInto.bind(rich);
  rich.renderInto=function(container,report){
    const publicStage=!!container?.closest?.('#allamo-public-client-portal')||container?.hasAttribute?.('data-pc-report-stage');
    if(publicStage)return client.renderInto(container,report);
    return original(container,report);
  };
})();
