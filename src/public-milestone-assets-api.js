// Download/visualização pública de arquivos de marco: sempre amarrado à empresa da URL e somente client_visible=1.
if(path.match(/^public-milestone-assets\/[^/]+\/content$/)&&request.method==='GET'){
  const id=decodeURIComponent(path.split('/')[1]),company=url.searchParams.get('company');if(!company)return json({error:'Informe a empresa'},400);
  const a=await DB.prepare('SELECT * FROM project_milestone_assets WHERE id=? AND company_id=? AND client_visible=1 AND archived_at IS NULL').bind(id,company).first();if(!a)return json({error:'Arquivo não disponível para esta empresa'},404);
  const p=await DB.prepare('SELECT id,company_id FROM projects WHERE id=?').bind(a.project_id).first();if(!p||String(p.company_id)!==String(company))return json({error:'Contexto inválido'},403);
  if(a.asset_type!=='FILE'||!a.object_key)return json({error:'Arquivo indisponível'},404);
  let body=null,mime=a.mime_type||'application/octet-stream';
  if(String(a.object_key).startsWith('d1:')){
    const rows=(await DB.prepare('SELECT data_blob FROM tenant_file_chunks WHERE file_id=? AND company_id=? ORDER BY chunk_no ASC').bind(id,company).all()).results||[];if(!rows.length)return json({error:'Arquivo indisponível'},404);
    const bytes=v=>v instanceof ArrayBuffer?new Uint8Array(v):ArrayBuffer.isView(v)?new Uint8Array(v.buffer,v.byteOffset,v.byteLength):Array.isArray(v)?Uint8Array.from(v):new Uint8Array();const chunks=rows.map(r=>bytes(r.data_blob)),total=chunks.reduce((s,b)=>s+b.byteLength,0),out=new Uint8Array(total);let pos=0;for(const b of chunks){out.set(b,pos);pos+=b.byteLength}body=out;
  }else{
    if(!env.DOCS)return json({error:'Arquivo indisponível'},404);const obj=await env.DOCS.get(a.object_key);if(!obj)return json({error:'Arquivo indisponível'},404);body=obj.body;mime=a.mime_type||obj.httpMetadata?.contentType||mime;
  }
  const h=new Headers();h.set('content-type',mime);h.set('content-disposition',`inline; filename="${String(a.file_name||'arquivo').replace(/["\r\n]/g,'')}"`);h.set('cache-control','public, max-age=60');return new Response(body,{headers:h});
}
