// Lista pesquisável de reports. Mantida separada para validar filtros/aliases no SQL final.
if(path==='report-records'&&request.method==='GET'){
  const where=['r.archived_at IS NULL'],args=[];
  if(scope){where.push('r.company_id=?');args.push(scope)}
  const company=url.searchParams.get('company');if(company){where.push('r.company_id=?');args.push(company)}
  const project=url.searchParams.get('project');if(project){where.push('r.project_id=?');args.push(project)}
  const status=url.searchParams.get('status');if(status){where.push('r.status=?');args.push(status)}
  const q=url.searchParams.get('q');if(q){where.push('(r.title LIKE ? OR r.reference LIKE ? OR r.executive_summary LIKE ? OR c.name LIKE ? OR p.name LIKE ?)');const like='%'+q+'%';args.push(like,like,like,like,like)}
  const sql="SELECT r.*,c.name AS company_name,p.name AS project_name,(SELECT COUNT(*) FROM report_versions v WHERE v.report_id=r.id) AS version_count,(SELECT COUNT(*) FROM report_roadmap_items m WHERE m.report_id=r.id AND m.archived_at IS NULL) AS roadmap_count FROM report_records r LEFT JOIN companies c ON c.id=r.company_id LEFT JOIN projects p ON p.id=r.project_id WHERE "+where.join(' AND ')+' ORDER BY r.updated_at DESC';
  return json((await DB.prepare(sql).bind(...args).all()).results||[]);
}
