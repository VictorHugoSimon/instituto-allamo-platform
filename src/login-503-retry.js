(()=>{
  if(window.__allamoLogin503Retry)return;window.__allamoLogin503Retry=true;
  const previous=window.fetch.bind(window);
  const isLogin=(input,init)=>{try{const u=new URL(String((input&&input.url)||input||''),location.href);return u.origin===location.origin&&u.pathname==='/api/login'&&String(init?.method||input?.method||'GET').toUpperCase()==='POST'}catch(_){return false}};
  window.fetch=async function(input,init={}){
    if(!isLogin(input,init))return previous(input,init);
    let response;
    for(let attempt=0;attempt<3;attempt++){
      response=await previous(input,{...init,cache:'no-store'});
      if(response.status!==503||attempt===2)return response;
      const wait=attempt===0?450:900;
      window.dispatchEvent(new CustomEvent('allamo:api-retry',{detail:{url:'/api/login',status:503,attempt:attempt+1,wait}}));
      await new Promise(r=>setTimeout(r,wait));
    }
    return response;
  };
})();
