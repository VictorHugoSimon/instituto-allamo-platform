// Download/visualização pública de arquivos de marco: sempre amarrado à empresa da URL e somente client_visible=1.
if(path.match(/^public-milestone-assets\/[^/]+\/content$/)&&request.method==='GET'){
  const id=decodeURIComponent(path.split('/')[1]),company=url.searchParams.get('company');if(!company)return json({error:'Informe a empresa'},400);
  const a=await DB.prepare('SELECT * FROM project_milestone_assets WHERE id=? AND company_id=? AND client_visible=1 AND archived_at IS NULL').bind(id,company).first();if(!a)return json({error:'Arquivo não disponível para esta empresa'},404);
  const p=await DB.prepare('SELECT id,company_id FROM projects WHERE id=?').bind(a.project_id).first();if(!p||String(p.company_id)!==String(company))return json({error:'Contexto inválido'},403);
  if(a.asset_type!=='FILE'||!a.object_key||!env.DOCS)return json({error:'Arquivo indisponível'},404);const obj=await env.DOCS.get(a.object_key);if(!obj)return json({error:'Arquivo indisponível'},404);
  const h=new Headers();h.set('content-type',a.mime_type||obj.httpMetadata?.contentType||'application/octet-stream');h.set('content-disposition',`inline; filename="${String(a.file_name||'arquivo').replace(/["\r\n]/g,'')}"`);h.set('cache-control','public, max-age=60');return new Response(obj.body,{headers:h});
}
