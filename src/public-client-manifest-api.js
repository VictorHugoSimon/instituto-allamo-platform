// Manifesto PWA público e multitenant.
// Cada empresa recebe identidade/start_url próprios; nunca cai na raiz de login interno.
if(path==='public-client-manifest'&&request.method==='GET'){
  const requested=String(url.searchParams.get('company')||'').trim();
  if(!requested)return new Response(JSON.stringify({error:'Informe a empresa'}),{status:400,headers:{'content-type':'application/json','cache-control':'no-store'}});

  const token=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  let co=await DB.prepare('SELECT * FROM companies WHERE CAST(id AS TEXT)=? OR lower(CAST(id AS TEXT))=lower(?) LIMIT 1').bind(requested,requested).first();
  if(!co){
    const wanted=token(requested);
    const all=(await DB.prepare('SELECT * FROM companies').all()).results||[];
    const matches=all.filter(row=>[row.public_slug,row.slug,row.client_slug,row.name,row.company_name,row.nome_fantasia].some(v=>v!=null&&token(v)===wanted));
    if(matches.length>1)return new Response(JSON.stringify({error:'Link público ambíguo. Gere um novo link para esta empresa.'}),{status:409,headers:{'content-type':'application/json','cache-control':'no-store'}});
    co=matches[0]||null;
  }
  if(!co)return new Response(JSON.stringify({error:'Empresa não encontrada'}),{status:404,headers:{'content-type':'application/json','cache-control':'no-store'}});

  const canonicalId=String(co.id);
  const displayName=String(co.name||co.company_name||co.nome_fantasia||canonicalId);
  const manifest={
    id:'/?cliente_app='+encodeURIComponent(canonicalId),
    name:'Portal PMO · '+displayName,
    short_name:displayName.length>24?displayName.slice(0,24):displayName,
    description:'Acompanhamento de projetos e Reports · Instituto Államo',
    start_url:'/?cliente='+encodeURIComponent(canonicalId)+'&source=pwa',
    scope:'/',
    display:'standalone',
    display_override:['standalone','minimal-ui'],
    background_color:'#302f39',
    theme_color:'#302f39',
    orientation:'any',
    icons:[
      {src:'/assets/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},
      {src:'/assets/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},
      {src:'/assets/icon-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}
    ]
  };
  return new Response(JSON.stringify(manifest),{status:200,headers:{'content-type':'application/manifest+json; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate, max-age=0','pragma':'no-cache','expires':'0','x-allamo-tenant':canonicalId}});
}
