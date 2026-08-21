// _worker.js — Portal PMO Allamo (Cloudflare Pages Advanced Mode)
// Um único arquivo (nome sem colchetes) roteia /api/* e serve o site.
// Binding D1 "DB" e Workers AI "AI".

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

// Modelo padrão do Status Report (provisionado por projeto)
function defaultReport(co) {
  const prog = co && co.progress != null ? co.progress : 0;
  const semColor = { g:'#0ca30c', a:'#e0951a', r:'#d03b3b', s:'#898781' };
  const sc = semColor[co ? co.status : 's'] || '#898781';
  const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const now = new Date();
  const ref = MESES[now.getUTCMonth()] + '/' + String(now.getUTCFullYear()).slice(2);
  return {
    title: 'Governança da Implantação · ' + (co ? co.name : 'Projeto'),
    client: co ? co.name : '—', ref,
    pillars: [
      { num:'1', name:'Governança da Implantação ERP', desc:'PMO e apoio estratégico para a implantação alinhada a processos, pessoas e objetivos.', tag:'Rumo certo, execução segura' },
      { num:'2', name:'Estruturação Gerencial e Operacional', desc:'Organização, processos e responsabilidades claras para uma gestão profissional.', tag:'Processos fortes, equipes alinhadas' },
      { num:'3', name:'Estruturação Financeira e Inteligência Gerencial', desc:'Visão financeira integrada e análise estratégica para dar segurança às decisões.', tag:'Decisões seguras, crescimento sustentável' },
      { num:'4', name:'Indicadores e Evolução Analítica', desc:'Indicadores e dashboards para acompanhar a performance e transformar dados em decisão.', tag:'Dados que geram resultados' }
    ],
    semaphores: [
      { label:'Prazo & Avanço', color: prog>=70?semColor.g:(prog>=40?semColor.a:sc), state: prog>=70?'No ritmo':(prog>=40?'Atenção':'Monitorar'), desc: prog+'% de avanço estimado.' },
      { label:'Escopo', color: semColor.a, state:'Em andamento', desc: (co && co.summary) ? co.summary : 'Escopo em execução conforme plano.' },
      { label:'Situação PMO', color: sc, state: co ? co.status_text : 'A reconciliar', desc:'Leitura do responsável PMO ('+(co ? co.lead : '—')+').' }
    ],
    kpis: [
      { label:'Avanço do projeto', value:String(prog), unit:'%', note:'estimativa PMO', pct:prog+'%' },
      { label:'Fases concluídas', value:'2', unit:' / 5', note:'preparação + diagnóstico', pct:'40%' },
      { label:'Módulos mapeados', value:'7', unit:' / 7', note:'blueprint AS-IS/TO-BE', pct:'100%' },
      { label:'Pilar em execução', value:'1', unit:' / 4', note:'governança da implantação', pct:'25%' }
    ],
    phases: [
      { title:'Fase 1 · Preparação e Planejamento', pct:'4 de 4', items:[
        { name:'Plano de Projeto', tag:'ok' }, { name:'EAP e Cronograma', tag:'ok' }, { name:'Blueprint AS-IS/TO-BE', tag:'ok' }, { name:'Workshops por módulo', tag:'ok' } ] },
      { title:'Fase 2 · Diagnóstico e Desenho', pct:'2 de 5', items:[
        { name:'Aceite das especificações funcionais', tag:'ok' }, { name:'Orçamento de customizações', tag:'ok' }, { name:'Cronograma de implantação', tag:'run' }, { name:'Matriz RACI', tag:'dev' }, { name:'Plano de Riscos', tag:'dev' } ] }
    ],
    hourKpis: [
      { label:'Horas consumidas', value:'0', unit:'h', note:'no ciclo', pct:'0%', barColor:'#2a78d6' },
      { label:'Aderência ao plano', value:'—', unit:'', note:'real × previsto', pct:'0%', barColor:'#2a78d6' },
      { label:'Saldo de horas', value:'—', unit:'h', note:'disponível', pct:'100%', barColor:'#b88b78' },
      { label:'Tempo decorrido', value:'0', unit:' / 12m', note:'início do contrato', pct:'0%', barColor:'#2a78d6' }
    ],
    hoursMeta: 38,
    hoursBars: [],
    risks: [
      { color:'#e0951a', title:'Governança a formalizar', desc:'Matriz RACI e Plano de Riscos ainda a formalizar.', meta:'Ação Államo' }
    ],
    next: [
      { i:'1', title:'Definir donos de processo', desc:'Nomear key-users por área.' },
      { i:'2', title:'Formalizar a Fase 1', desc:'Submeter Matriz RACI e Plano de Riscos.' }
    ],
    tap: {
      version: '1.0', kickoff: '', type: 'Implantação ERP', elaboradoPor: (co?co.lead:'A definir'), cliente: (co?co.name:''),
      objetivo_doc: 'Formalizar a abertura do projeto, alinhando objetivos, escopo, marcos, partes interessadas e riscos entre Instituto Államo e o cliente.',
      situacao: 'Descreva a situação atual e a justificativa que motiva o projeto.',
      objetivo_geral: 'Objetivo geral do projeto.',
      objetivos_especificos: ['Objetivo específico 1', 'Objetivo específico 2'],
      marcos: [ { fase:'Blueprint & Planejamento', data:'A definir' }, { fase:'Parametrização & Validação', data:'A definir' }, { fase:'Go-Live', data:'A definir' } ],
      stakeholders: [ { nome:(co?co.lead:'A definir'), papel:'Responsável PMO (Államo)' }, { nome:'A definir', papel:'Sponsor (Cliente)' } ],
      restricoes: ['Prazo e janela de operação do cliente', 'Disponibilidade de key-users'],
      fatores_sucesso: ['Engajamento da liderança', 'Dados de migração íntegros', 'Validações no prazo'],
      riscos_tap: [ { risco:'Atraso nas validações', mitig:'Cadência semanal e donos definidos' } ],
      equipe: [ { nome:(co?co.lead:'A definir'), funcao:'Consultor PMO' }, { nome:'A definir', funcao:'Techlead' } ]
    },
    raci: [
      { atividade:'Governança / PMO', r:'Instituto Államo', a:'Instituto Államo', c:'Cliente', i:'Sponsor' },
      { atividade:'Parametrização do sistema', r:(co&&co.own_system?'Instituto Államo':'Fornecedor'), a:'Instituto Államo', c:'Cliente', i:'Key-users' },
      { atividade:'Validação de processos', r:'Cliente', a:'Instituto Államo', c:'Key-users', i:'Sponsor' },
      { atividade:'Migração de dados', r:(co&&co.own_system?'Instituto Államo':'Fornecedor'), a:'Instituto Államo', c:'Cliente', i:'—' }
    ],
    riskMatrix: [
      { risco:'Atraso nas validações', prob:'Média', impacto:'Alto', resp:'Instituto Államo', mitig:'Cadência semanal e donos definidos' },
      { risco:'Dependência do fornecedor', prob:'Média', impacto:'Alto', resp:(co&&co.own_system?'Instituto Államo':'Fornecedor'), mitig:'Alinhamento de cronograma conjunto' }
    ],
    tracks: [
      { owner:'Instituto Államo (PMO/Consultoria)', color:'#302f39', items:[ { name:'Governança e cadência', st:'run' }, { name:'Blueprint e validações', st:'run' } ] },
      { owner:(co&&co.own_system?'Instituto Államo (Sistema SallamoS)':'Fornecedor terceiro (ex.: TOTVS)'), color:'#b88b78', items:[ { name:'Implantação do sistema', st:'run' }, { name:'Cronograma do fornecedor', st:'pend' } ] }
    ]
  };
}

// Enfileira e (se houver provedor) envia e-mail. Sempre grava no outbox como registro/documento.
async function sendEmail(env, to, subject, body) {
  if (!to) return;
  try {
    await env.DB.prepare("INSERT INTO email_outbox (to_email,subject,body,status,created_at) VALUES (?,?,?,?,datetime('now'))")
      .bind(to, subject, body, env.RESEND_API_KEY ? 'enviando' : 'pendente').run();
  } catch(e){}
  if (!env.RESEND_API_KEY) return; // sem provedor: fica registrado no outbox
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method:'POST', headers:{ 'authorization':'Bearer '+env.RESEND_API_KEY, 'content-type':'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM || 'PMO Allamo <onboarding@resend.dev>', to:[to], subject, html: body.replace(/\n/g,'<br>') })
    });
    await env.DB.prepare("UPDATE email_outbox SET status=?, sent_at=datetime('now') WHERE id=(SELECT MAX(id) FROM email_outbox WHERE to_email=?)")
      .bind(r.ok?'enviado':'falhou', to).run();
  } catch(e){}
}

async function logEvent(env, user, action, target, detail) {
  try {
    await env.DB.prepare(
      "INSERT INTO audit_log (ts, actor, role, company_id, action, target, detail) VALUES (datetime('now'),?,?,?,?,?,?)"
    ).bind(user ? user.name : 'sistema', user ? user.role : '-', user ? user.company_id : null, action, target || '', detail || '').run();
  } catch (e) { /* nunca quebra a operação principal por causa do log */ }
}

// ===== Integração Linear (SOMENTE LEITURA) =====
// Lê issues via GraphQL e grava na tabela `issues` do portal. Nada é alterado no Linear.
function norm(s){ return (s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,''); }
// ===== Importação de horas (Google Sheets publicado como CSV) =====
function parseCSV(text){
  const rows=[]; let row=[], cur='', q=false;
  for(let i=0;i<text.length;i++){ const ch=text[i];
    if(q){ if(ch==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=ch; }
    else { if(ch==='"')q=true; else if(ch===','){row.push(cur);cur='';} else if(ch==='\n'){row.push(cur);rows.push(row);row=[];cur='';} else if(ch==='\r'){} else cur+=ch; }
  }
  if(cur!==''||row.length){ row.push(cur); rows.push(row); }
  return rows;
}
async function importHoras(env){
  const url=env.HORAS_CSV_URL;
  if(!url) return { ok:false, error:'HORAS_CSV_URL não configurada' };
  let text;
  try{ const r=await fetch(url); if(!r.ok) return {ok:false,error:'HTTP '+r.status+' ao ler a planilha'}; text=await r.text(); }
  catch(e){ return {ok:false,error:String(e)}; }
  const rows=parseCSV(text).filter(r=>r.some(c=>(c||'').trim()!==''));
  if(rows.length<2) return {ok:false,error:'Planilha vazia ou sem dados'};
  const head=rows[0].map(h=>norm(h));
  const find=(...keys)=>{ for(let i=0;i<head.length;i++){ if(keys.some(k=>head[i].includes(k))) return i; } return -1; };
  const ci=find('empresa','cliente'); const pi=find('projeto','sistema'); const hi=find('hora','horastrab','qtdhora','tempo'); const mi=find('mes','data','competencia','periodo'); const pei=find('consultor','pessoa','colaborador','responsavel','recurso');
  if(ci<0 && pi<0) return {ok:false,error:'Não achei coluna de empresa/projeto no cabeçalho'};
  if(hi<0) return {ok:false,error:'Não achei coluna de horas no cabeçalho'};
  const agg={};
  for(let r=1;r<rows.length;r++){ const row=rows[r];
    const ck=ci>=0?norm(row[ci]):''; const pk=pi>=0?norm(row[pi]):'';
    let hv=(row[hi]||'').toString().replace('.','').replace(',','.').replace(/[^0-9.]/g,''); const h=parseFloat(hv)||0;
    if(!h) continue;
    const mes=mi>=0?(row[mi]||'').toString().slice(0,7):''; const pessoa=pei>=0?(row[pei]||'').toString():'';
    const key=ck+'|'+pk+'|'+mes+'|'+norm(pessoa);
    if(!agg[key]) agg[key]={company_key:ck,project_key:pk,mes,pessoa,horas:0};
    agg[key].horas+=h;
  }
  const list=Object.values(agg);
  const stmts=[env.DB.prepare('DELETE FROM horas_import')];
  for(const a of list){ stmts.push(env.DB.prepare("INSERT INTO horas_import (company_key,project_key,mes,pessoa,horas,updated_at) VALUES (?,?,?,?,?,datetime('now'))").bind(a.company_key,a.project_key,a.mes,a.pessoa,a.horas)); }
  stmts.push(env.DB.prepare("INSERT INTO sync_state (source,last_run,detail) VALUES ('horas',datetime('now'),?) ON CONFLICT(source) DO UPDATE SET last_run=datetime('now'), detail=excluded.detail").bind(list.length+' lançamentos'));
  await env.DB.batch(stmts);
  return { ok:true, linhas:list.length };
}
async function syncLinear(env) {
  // Aceita várias chaves (1 por workspace): LINEAR_API_KEY, LINEAR_API_KEY_2 ... _6
  const keys = [];
  for (const k of ['LINEAR_API_KEY','LINEAR_API_KEY_2','LINEAR_API_KEY_3','LINEAR_API_KEY_4','LINEAR_API_KEY_5','LINEAR_API_KEY_6']) {
    if (env[k]) keys.push(env[k]);
  }
  if (!keys.length) return { ok:false, error:'Nenhuma LINEAR_API_KEY configurada' };
  const companies = (await env.DB.prepare('SELECT id,name FROM companies').all()).results || [];
  const matchCompany = (teamName, teamKey, projName) => {
    const cands = [teamName, teamKey, projName].map(norm).filter(Boolean);
    for (const c of companies) { const ci=norm(c.id), cn=norm(c.name); if (cands.some(x=>x===ci||x===cn||x.includes(cn)||cn.includes(x))) return c.id; }
    return null;
  };
  const query = `query($after:String){ issues(first:100, after:$after){ pageInfo{ hasNextPage endCursor } nodes{ identifier title url estimate dueDate priorityLabel state{ name } assignee{ name } team{ name key } project{ name } labels{ nodes{ name } } } } }`;
  let all = [], errors = [];
  for (const key of keys) {
    let after = null, pages = 0;
    try {
      do {
        const resp = await fetch('https://api.linear.app/graphql', {
          method:'POST', headers:{ 'content-type':'application/json', 'authorization': key },
          body: JSON.stringify({ query, variables:{ after } })
        });
        const j = await resp.json();
        if (j.errors) { errors.push(JSON.stringify(j.errors).slice(0,120)); break; }
        const data = j.data && j.data.issues;
        if (!data) { errors.push('resposta inesperada'); break; }
        all = all.concat(data.nodes);
        after = data.pageInfo.hasNextPage ? data.pageInfo.endCursor : null;
        pages++;
      } while (after && pages < 30);
    } catch (e) { errors.push(String(e).slice(0,120)); }
  }
  if (!all.length && errors.length) return { ok:false, error: errors.join(' | ') };

  const today = new Date().toISOString().slice(0,10);
  let matched = 0;
  const stmts = [];
  // limpa apenas issues previamente importadas do Linear (as que têm linear_url)
  stmts.push(env.DB.prepare("DELETE FROM issues WHERE linear_url IS NOT NULL AND linear_url != ''"));
  for (const n of all) {
    const cid = matchCompany(n.team && n.team.name, n.team && n.team.key, n.project && n.project.name);
    if (cid) matched++;
    const labels = (n.labels && n.labels.nodes ? n.labels.nodes.map(l=>l.name) : []).join(', ');
    const due = n.dueDate || '';
    const overdue = due && due < today && !/done|cancel|conclu/i.test(n.state ? n.state.name : '');
    stmts.push(env.DB.prepare(
      "INSERT INTO issues (id,title,project,company_id,status,priority,owner,due_date,flag,flag_type,estimate,labels,linear_url,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(id) DO UPDATE SET title=excluded.title,project=excluded.project,company_id=excluded.company_id,status=excluded.status,priority=excluded.priority,owner=excluded.owner,due_date=excluded.due_date,flag=excluded.flag,flag_type=excluded.flag_type,estimate=excluded.estimate,labels=excluded.labels,linear_url=excluded.linear_url,updated_at=datetime('now')"
    ).bind(
      n.identifier, n.title || '', (n.project && n.project.name) || (n.team && n.team.name) || 'Linear', cid,
      (n.state && n.state.name) || '', n.priorityLabel || 'Sem prioridade', (n.assignee && n.assignee.name) || 'Não atribuído',
      due, overdue ? 'Prazo vencido' : '', overdue ? 'c' : '', (n.estimate != null ? n.estimate : null), labels, n.url || '#'
    ));
  }
  stmts.push(env.DB.prepare("INSERT INTO sync_state (source,last_run,detail) VALUES ('linear',datetime('now'),?) ON CONFLICT(source) DO UPDATE SET last_run=datetime('now'), detail=excluded.detail")
    .bind(keys.length + ' workspace(s) · ' + all.length + ' issues · ' + matched + ' com empresa'));
  await env.DB.batch(stmts);
  return { ok:true, total: all.length, matched, workspaces: keys.length };
}

async function currentUser(request, env) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return null;
  const s = await env.DB.prepare(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > datetime('now')"
  ).bind(token).first();
  return s || null;
}
function scopeCompany(user, requested) {
  if (user.role === 'gestor' || user.role === 'usuario') return user.company_id;
  return requested && requested !== 'all' ? requested : null;
}

async function handleApi(request, env, url) {
  const path = url.pathname.replace(/^\/api\/?/, '');
  const DB = env.DB;
  try {
    // REPORT PÚBLICO (sem login) — link aberto do cliente
    if (path === 'public-report' && request.method === 'GET') {
      const cid = url.searchParams.get('company');
      if (!cid) return json({ error: 'Informe a empresa' }, 400);
      const co = await DB.prepare('SELECT * FROM companies WHERE id = ?').bind(cid).first();
      if (!co) return json({ error: 'Empresa não encontrada' }, 404);
      const row = await DB.prepare('SELECT data_json, ref, updated_at FROM project_reports WHERE company_id = ?').bind(cid).first();
      let data; if (row && row.data_json) { try { data = JSON.parse(row.data_json); } catch(e){ data = defaultReport(co); } } else { data = defaultReport(co); }
      const gmuds = (await DB.prepare("SELECT id,title,project,window_txt,status,description FROM gmud WHERE company_id=? AND client_visible=1 AND status IN ('Aprovada','Agendada','Implementada') ORDER BY id DESC LIMIT 20").bind(cid).all()).results || [];
      const updates = (await DB.prepare("SELECT author,message,created_at FROM project_updates WHERE company_id=? ORDER BY id DESC LIMIT 20").bind(cid).all()).results || [];
      return json({ data, gmuds, updates, company: { id: co.id, name: co.name }, meta: { ref: row ? row.ref : null, updated_at: row ? row.updated_at : null } });
    }

    // ATUALIZAÇÃO DO PROJETO enviada pelo gestor via link aberto (sem login)
    if (path === 'public-update' && request.method === 'POST') {
      const b = await request.json();
      if (!b.company_id || !b.message) return json({ error: 'Informe empresa e mensagem' }, 400);
      const co = await DB.prepare('SELECT name FROM companies WHERE id = ?').bind(b.company_id).first();
      if (!co) return json({ error: 'Empresa não encontrada' }, 404);
      await DB.prepare("INSERT INTO project_updates (company_id,project_id,author,message,status,created_at) VALUES (?,?,?,?,'novo',datetime('now'))")
        .bind(b.company_id, b.project_id||'', (b.author||'Gestor').slice(0,80), String(b.message).slice(0,2000)).run();
      await DB.prepare("INSERT INTO notifications (company_id,project,type,title,message,created_at) VALUES (?,?,?,?,?,datetime('now'))")
        .bind(b.company_id, b.project_id||'', 'atualizacao', 'Atualização de ' + (b.author||'gestor') + ' — ' + co.name, String(b.message).slice(0,300)).run();
      return json({ ok: true });
    }

    if (path === 'login' && request.method === 'POST') {
      const { email, password } = await request.json();
      const user = await DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
      if (!user || user.status === 'Bloqueado') return json({ error: 'Credenciais inválidas' }, 401);
      const hash = await sha(password + ':' + email);
      if (user.password_hash !== hash) return json({ error: 'Credenciais inválidas' }, 401);
      const token = crypto.randomUUID();
      await DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now','+12 hours'))").bind(token, user.id).run();
      await logEvent(env, user, 'login', 'sessão', 'Entrou no portal');
      return json({ token, user: { name: user.name, role: user.role, company_id: user.company_id } });
    }

    const user = await currentUser(request, env);
    if (!user) return json({ error: 'Não autenticado' }, 401);
    const scope = scopeCompany(user, url.searchParams.get('company'));
    const where = scope ? ' WHERE company_id = ?' : '';
    const bind = scope ? [scope] : [];

    // EMPRESAS: criar (rota dedicada)
    if ((path === 'company-create' || path === 'companies') && request.method === 'POST') {
      if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const b = await request.json();
      if (!b.name) return json({ error: 'Nome da empresa é obrigatório' }, 400);
      const id = (b.id || b.name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'').slice(0,32) || ('emp'+Date.now());
      const exists = await DB.prepare('SELECT id FROM companies WHERE id = ?').bind(id).first();
      if (exists) return json({ error: 'Já existe empresa com esse identificador' }, 409);
      await DB.prepare('INSERT INTO companies (id,name,city,system,own_system,lead,start_date,status,status_text,pmo_mode,progress,summary,email,owner_email,grupo,billing_to,billing_email,billing_amount,billing_day,stakeholders) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(id, b.name, b.city||'', b.system||'SallamoS', b.own_system?1:0, b.lead||'A definir', b.start_date||'', b.status||'s', b.status_text||'Em implantação', b.pmo_mode||'PMO Direto', b.progress!=null?b.progress:0, b.summary||'', b.email||'', b.owner_email||'', b.grupo||'', b.billing_to||'', b.billing_email||'', b.billing_amount||'', b.billing_day||'', b.stakeholders||'').run();
      await logEvent(env, user, 'empresa:criar', b.name, 'Nova empresa (' + id + ')');
      return json({ ok: true, id });
    }
    if (path === 'companies' && request.method === 'GET') {
      const sql = (user.role === 'gestor' || user.role === 'usuario')
        ? 'SELECT * FROM companies WHERE id = ?' : 'SELECT * FROM companies ORDER BY name';
      const r = await DB.prepare(sql).bind(...(scope ? [scope] : [])).all();
      return json(r.results);
    }
    // EMPRESAS: editar (admin, pmo)
    if (path.startsWith('companies/') && request.method === 'POST') {
      if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const cid = decodeURIComponent(path.split('/')[1]);
      const b = await request.json();
      const co = await DB.prepare('SELECT id FROM companies WHERE id = ?').bind(cid).first();
      if (!co) return json({ error: 'Empresa não encontrada' }, 404);
      await DB.prepare('UPDATE companies SET name=?, city=?, lead=?, email=?, owner_email=?, summary=?, grupo=?, system=?, billing_to=?, billing_email=?, billing_amount=?, billing_day=?, stakeholders=? WHERE id=?')
        .bind(b.name||'', b.city||'', b.lead||'', b.email||'', b.owner_email||'', b.summary||'', b.grupo||'', b.system||'SallamoS', b.billing_to||'', b.billing_email||'', b.billing_amount||'', b.billing_day||'', b.stakeholders||'', cid).run();
      await logEvent(env, user, 'empresa:editar', b.name||cid, 'Dados/e-mail atualizados');
      return json({ ok: true });
    }
    // EMPRESAS: excluir (admin, pmo) — remove empresa e dados vinculados
    if (path.startsWith('companies/') && request.method === 'DELETE') {
      if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const cid = decodeURIComponent(path.split('/')[1]);
      const co = await DB.prepare('SELECT name FROM companies WHERE id = ?').bind(cid).first();
      if (!co) return json({ error: 'Empresa não encontrada' }, 404);
      await DB.batch([
        DB.prepare('DELETE FROM projects WHERE company_id = ?').bind(cid),
        DB.prepare('DELETE FROM issues WHERE company_id = ?').bind(cid),
        DB.prepare('DELETE FROM gmud WHERE company_id = ?').bind(cid),
        DB.prepare('DELETE FROM releases WHERE company_id = ?').bind(cid),
        DB.prepare('DELETE FROM documents WHERE company_id = ?').bind(cid),
        DB.prepare('DELETE FROM project_reports WHERE company_id = ?').bind(cid),
        DB.prepare('DELETE FROM notifications WHERE company_id = ?').bind(cid),
        DB.prepare('DELETE FROM companies WHERE id = ?').bind(cid)
      ]);
      await logEvent(env, user, 'empresa:excluir', co.name, 'Empresa e dados vinculados removidos (' + cid + ')');
      return json({ ok: true });
    }
    if (path === 'projects' && request.method === 'GET')  return json((await DB.prepare('SELECT * FROM projects' + where).bind(...bind).all()).results);
    if (path === 'issues' && request.method === 'GET')    return json((await DB.prepare('SELECT * FROM issues' + where).bind(...bind).all()).results);
    if (path === 'releases' && request.method === 'GET') {
      const rel = (await DB.prepare('SELECT * FROM releases' + where + ' ORDER BY rel_date DESC').bind(...bind).all()).results || [];
      // mescla GMUDs implementadas como viradas automáticas
      const gwhere = scope ? " AND company_id = ?" : "";
      const gb = scope ? [scope] : [];
      const gm = (await DB.prepare("SELECT id,title,company_id,project,window_txt,description FROM gmud WHERE status='Implementada'" + gwhere + " ORDER BY id DESC").bind(...gb).all()).results || [];
      const fromGmud = gm.map(g=>({ id:'g'+g.id, rel_date:(g.window_txt||''), company_id:g.company_id, title:'[GMUD '+g.id+'] '+g.title, description:(g.project?('Áreas: '+g.project+'. '):'')+(g.description||''), source:'gmud' }));
      return json(rel.concat(fromGmud));
    }
    if (path === 'releases' && request.method === 'POST') {
      if (!['admin','pmo','techlead'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const b = await request.json();
      if (!b.title) return json({ error: 'Informe o título' }, 400);
      await DB.prepare("INSERT INTO releases (rel_date,company_id,title,description) VALUES (?,?,?,?)").bind(b.rel_date||'', b.company_id||'', b.title, b.description||'').run();
      await logEvent(env, user, 'virada:criar', b.title, b.company_id||'');
      return json({ ok: true });
    }
    if (path.startsWith('releases/') && request.method === 'DELETE') {
      if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const id = path.split('/')[1];
      await DB.prepare('DELETE FROM releases WHERE id = ?').bind(id).run();
      await logEvent(env, user, 'virada:excluir', id, 'Virada removida');
      return json({ ok: true });
    }
    if (path === 'documents' && request.method === 'GET') return json((await DB.prepare('SELECT * FROM documents' + where).bind(...bind).all()).results);
    if (path === 'gmud' && request.method === 'GET') {
      const sql = 'SELECT * FROM gmud' + where + (scope && (user.role==='gestor'||user.role==='usuario') ? ' AND client_visible = 1' : '') + ' ORDER BY id DESC';
      return json((await DB.prepare(sql).bind(...bind).all()).results);
    }
    if (path === 'notifications' && request.method === 'GET') {
      const rows = await DB.prepare('SELECT * FROM notifications' + where + ' ORDER BY id DESC LIMIT 50').bind(...bind).all();
      return json(rows.results);
    }
    if (path === 'notifications' && request.method === 'POST') {
      if (!['admin','pmo','techlead'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const b = await request.json();
      if (!b.title || !b.company_id) return json({ error: 'Informe título e empresa' }, 400);
      await DB.prepare("INSERT INTO notifications (company_id,project,type,title,message,created_at) VALUES (?,?,?,?,?,datetime('now'))")
        .bind(b.company_id, b.project||'', b.type||'aviso', b.title, b.message||'').run();
      const co = await DB.prepare('SELECT name, owner_email, email FROM companies WHERE id = ?').bind(b.company_id).first();
      const dest = (co && (co.owner_email || co.email)) || '';
      if (dest && b.email) await sendEmail(env, dest, 'Aviso — ' + b.title + ' (' + (co?co.name:'') + ')', (b.project?('Projeto: '+b.project+'\n\n'):'') + (b.message||''));
      await logEvent(env, user, 'notificacao:criar', b.title, (co?co.name:b.company_id) + (b.project?(' · '+b.project):''));
      return json({ ok: true });
    }
    if (path.startsWith('notifications/') && request.method === 'POST') {
      const id = path.split('/')[1];
      await DB.prepare('UPDATE notifications SET read_flag=1 WHERE id=?').bind(id).run();
      return json({ ok: true });
    }

    // GMUD: criar + notificar
    if (path === 'gmud' && request.method === 'POST') {
      if (!['admin','pmo','gestor','techlead'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const b = await request.json();
      if (!b.title || !b.company_id) return json({ error: 'Informe título e empresa' }, 400);
      if (scope && b.company_id !== scope) return json({ error: 'Fora do escopo' }, 403);
      const seq = (await DB.prepare("SELECT COUNT(*) AS n FROM gmud").first()).n + 1;
      const id = 'GMUD-' + String(seq).padStart(3,'0');
      await DB.prepare("INSERT INTO gmud (id,title,company_id,project,type,risk,status,requester,approver,techlead,window_txt,affects,rollback,description,client_visible,pmo_ok,techlead_ok,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,datetime('now'))")
        .bind(id, b.title, b.company_id, b.project||'', b.type||'Normal', b.risk||'Médio', 'Solicitada', user.name, b.approver||'PMO', b.techlead||'Techlead', b.window_txt||'A definir', b.affects||'', b.rollback||'', b.description||'', b.client_visible===false?0:1).run();
      const co = await DB.prepare('SELECT name FROM companies WHERE id = ?').bind(b.company_id).first();
      await DB.prepare("INSERT INTO notifications (company_id,project,type,title,message,created_at) VALUES (?,?,?,?,?,datetime('now'))")
        .bind(b.company_id, b.project||'', 'gmud', 'Nova mudança: ' + b.title, 'Uma GMUD ('+id+') foi aberta para ' + (co?co.name:b.company_id) + ' e aguarda aprovação.').run();
      await logEvent(env, user, 'gmud:criar', id, b.title + ' → ' + (co?co.name:b.company_id));
      const coEmail = await DB.prepare('SELECT owner_email, email FROM companies WHERE id = ?').bind(b.company_id).first();
      const dest = (coEmail && (coEmail.owner_email || coEmail.email)) || '';
      if (dest) await sendEmail(env, dest, 'Nova mudança (GMUD ' + id + ') — ' + (co?co.name:''), 'Uma mudança foi registrada para ' + (co?co.name:'') + '.\n\nGMUD: ' + id + '\nTítulo: ' + b.title + '\nProjetos: ' + (b.project||'—') + '\nJanela prevista: ' + (b.window_txt||'a confirmar') + '\n\nVocê será avisado quando for aprovada. Este e-mail serve como registro da comunicação.');
      return json({ ok: true, id });
    }
    // GMUD: aprovação dupla / rejeição
    if (path.startsWith('gmud/') && request.method === 'POST') {
      const id = path.split('/')[1];
      const body = await request.json();
      const gate = body.gate || (user.role==='techlead' ? 'techlead' : 'pmo');
      const decision = body.decision || 'approve';
      const canGate = { pmo: ['admin','pmo'], techlead: ['admin','techlead'] };
      if (!(canGate[gate] || []).includes(user.role)) return json({ error: 'Sem permissão para o gate ' + gate }, 403);
      const g = await DB.prepare('SELECT * FROM gmud WHERE id = ?').bind(id).first();
      if (!g) return json({ error: 'GMUD não encontrada' }, 404);
      if (decision === 'reject') {
        await DB.prepare("UPDATE gmud SET status='Rejeitada', decided_by=?, decided_at=datetime('now') WHERE id=?").bind(user.name, id).run();
        await logEvent(env, user, 'gmud:rejeitar', id, g.title + ' (gate ' + gate + ')');
        return json({ ok: true, status: 'Rejeitada' });
      }
      const pmoOk = gate==='pmo' ? 1 : (g.pmo_ok||0);
      const tlOk = gate==='techlead' ? 1 : (g.techlead_ok||0);
      const status = (pmoOk && tlOk) ? 'Aprovada' : 'Em aprovação';
      await DB.prepare("UPDATE gmud SET pmo_ok=?, techlead_ok=?, status=?, decided_by=?, decided_at=datetime('now') WHERE id=?").bind(pmoOk, tlOk, status, user.name, id).run();
      await logEvent(env, user, 'gmud:aprovar', id, g.title + ' (gate ' + gate + (status==='Aprovada'?' · aprovada':'') + ')');
      if (status === 'Aprovada' && g.client_visible) {
        const co = await DB.prepare('SELECT name FROM companies WHERE id = ?').bind(g.company_id).first();
        await DB.prepare("INSERT INTO notifications (company_id,project,type,title,message,created_at) VALUES (?,?,?,?,?,datetime('now'))")
          .bind(g.company_id, g.project||'', 'gmud-aprovada', 'Mudança aprovada: ' + g.title, 'Entra em ' + (g.window_txt||'data a confirmar') + (g.project?(' · áreas: '+g.project):'') + '. ' + (g.description||'')).run();
        const ce = await DB.prepare('SELECT owner_email, email, name FROM companies WHERE id = ?').bind(g.company_id).first();
        const d2 = (ce && (ce.owner_email || ce.email)) || '';
        if (d2) await sendEmail(env, d2, 'Mudança aprovada (GMUD '+g.id+') — '+(ce?ce.name:''), 'A mudança abaixo foi aprovada (PMO + Techlead) e está programada.\n\nGMUD: '+g.id+'\nTítulo: '+g.title+'\nProjetos: '+(g.project||'—')+'\nEntra em: '+(g.window_txt||'data a confirmar')+'\n\n'+(g.description||'')+'\n\nEste e-mail serve como validação e registro documental da mudança.');
      }
      return json({ ok: true, status, pmo_ok: pmoOk, techlead_ok: tlOk });
    }

    // PROJETOS: criar
    if (path === 'projects' && request.method === 'POST') {
      if (!['admin','pmo','gestor'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const b = await request.json();
      if (!b.name) return json({ error: 'Nome do projeto é obrigatório' }, 400);
      if (scope && b.company_id && b.company_id !== scope) return json({ error: 'Fora do escopo' }, 403);
      if (user.role === 'gestor') b.company_id = scope;
      const badgeMap = { 'Em andamento':'started', 'Backlog':'backlog', 'Completo':'completed', 'Cancelado':'canceled' };
      const r = await DB.prepare(
        'INSERT INTO projects (name,company_id,status,badge,urgency,summary,lead,start_date,meta_date,pmo_read,note,linear_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
      ).bind(b.name, b.company_id||null, b.status||'Backlog', badgeMap[b.status]||'backlog', b.urgency||'Média',
             b.summary||'', b.lead||'', b.start_date||'', b.meta_date||'', b.pmo_read||'Atenção', b.note||'', b.linear_url||'').run();
      await logEvent(env, user, 'projeto:criar', b.name, 'Novo projeto (' + (b.status||'Backlog') + ')');
      if (b.company_id) {
        const has = await DB.prepare('SELECT company_id FROM project_reports WHERE company_id = ?').bind(b.company_id).first();
        if (!has) {
          const co = await DB.prepare('SELECT * FROM companies WHERE id = ?').bind(b.company_id).first();
          const def = defaultReport(co);
          await DB.prepare("INSERT INTO project_reports (company_id, ref, data_json, updated_at, updated_by) VALUES (?,?,?,datetime('now'),?)").bind(b.company_id, def.ref, JSON.stringify(def), user.name).run();
          await logEvent(env, user, 'report:provisionar', b.company_id, 'Área do projeto criada automaticamente');
        }
      }
      return json({ ok: true, id: r.meta && r.meta.last_row_id });
    }
    // PROJETOS: excluir
    if (path.startsWith('projects/') && request.method === 'DELETE') {
      if (!['admin','pmo','gestor'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const id = path.split('/')[1];
      const p = await DB.prepare('SELECT name, company_id FROM projects WHERE id = ?').bind(id).first();
      if (!p) return json({ error: 'Projeto não encontrado' }, 404);
      if (scope && p.company_id !== scope) return json({ error: 'Fora do escopo' }, 403);
      await DB.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
      await logEvent(env, user, 'projeto:excluir', p.name, 'Projeto removido');
      return json({ ok: true });
    }

    // USUARIOS: criar
    if (path === 'users' && request.method === 'POST') {
      if (!['admin','pmo','gestor'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const b = await request.json();
      if (!b.name || !b.email || !b.password || !b.role) return json({ error: 'Preencha nome, e-mail, senha e perfil' }, 400);
      if (user.role !== 'admin' && !['gestor','usuario'].includes(b.role)) return json({ error: 'Você só pode criar acessos de cliente' }, 403);
      if (user.role === 'gestor') b.company_id = scope;
      const exists = await DB.prepare('SELECT id FROM users WHERE email = ?').bind(b.email).first();
      if (exists) return json({ error: 'Já existe um usuário com esse e-mail' }, 409);
      const hash = await sha(b.password + ':' + b.email);
      const company = (b.role === 'gestor' || b.role === 'usuario') ? (b.company_id || null) : null;
      await DB.prepare('INSERT INTO users (name,email,password_hash,role,company_id,status) VALUES (?,?,?,?,?,?)').bind(b.name, b.email, hash, b.role, company, b.status || 'Ativo').run();
      await logEvent(env, user, 'usuario:criar', b.email, b.name + ' (' + b.role + ')');
      return json({ ok: true });
    }
    if (path === 'users' && request.method === 'GET') {
      if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      return json((await DB.prepare('SELECT id,name,email,role,company_id,status FROM users ORDER BY id').all()).results);
    }
    // USUARIO: editar
    if (path.startsWith('users/') && request.method === 'POST') {
      if (user.role !== 'admin') return json({ error: 'Sem permissão' }, 403);
      const email = decodeURIComponent(path.split('/')[1]);
      const b = await request.json();
      const u = await DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
      if (!u) return json({ error: 'Usuário não encontrado' }, 404);
      // Só trocar senha
      if (b.password) {
        const hash = await sha(b.password + ':' + email);
        await DB.prepare('UPDATE users SET password_hash=? WHERE email=?').bind(hash, email).run();
        await logEvent(env, user, 'usuario:senha', email, 'Senha alterada');
        if (!b.role) return json({ ok: true });
      }
      const company = (b.role === 'gestor' || b.role === 'usuario') ? (b.company_id || null) : null;
      await DB.prepare('UPDATE users SET role=?, company_id=?, status=? WHERE email=?').bind(b.role, company, b.status || 'Ativo', email).run();
      await logEvent(env, user, 'usuario:editar', email, 'Perfil: ' + b.role + ' · ' + (b.status||'Ativo'));
      return json({ ok: true });
    }
    // USUARIO: excluir
    if (path.startsWith('users/') && request.method === 'DELETE') {
      if (user.role !== 'admin') return json({ error: 'Sem permissão' }, 403);
      const email = decodeURIComponent(path.split('/')[1]);
      const u = await DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
      if (!u) return json({ error: 'Usuário não encontrado' }, 404);
      await DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(u.id).run();
      await DB.prepare('DELETE FROM users WHERE email = ?').bind(email).run();
      await logEvent(env, user, 'usuario:excluir', email, 'Usuário removido');
      return json({ ok: true });
    }

    // LINEAR: sincronizar (somente leitura) + status
    if (path === 'linear-sync' && request.method === 'POST') {
      if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const r = await syncLinear(env);
      if (r.ok) await logEvent(env, user, 'linear:sync', 'demandas', r.total + ' issues lidas · ' + r.matched + ' vinculadas');
      return json(r, r.ok ? 200 : 502);
    }
    if (path === 'linear-status' && request.method === 'GET') {
      const s = await DB.prepare("SELECT last_run, detail FROM sync_state WHERE source='linear'").first();
      return json(s || { last_run: null, detail: 'nunca sincronizado' });
    }
    // HORAS: importar planilha (CSV publicado) + status
    if (path === 'horas-sync' && request.method === 'POST') {
      if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const r = await importHoras(env);
      if (r.ok) await logEvent(env, user, 'horas:sync', 'planilha', r.linhas + ' lançamentos importados');
      return json(r, r.ok ? 200 : 502);
    }
    if (path === 'horas-status' && request.method === 'GET') {
      const s = await DB.prepare("SELECT last_run, detail FROM sync_state WHERE source='horas'").first();
      return json(s || { last_run: null, detail: 'nunca importado' });
    }
    if (path === 'horas' && request.method === 'GET') {
      const rows = await DB.prepare('SELECT company_key, project_key, mes, SUM(horas) AS horas FROM horas_import GROUP BY company_key, project_key, mes').all();
      return json(rows.results || []);
    }

    // DOCUMENTOS: upload / listar / baixar / excluir
    if (path === 'doc-upload' && request.method === 'POST') {
      if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const b = await request.json();
      if (!b.name || !b.data_b64) return json({ error: 'Arquivo inválido' }, 400);
      const size = Math.floor((b.data_b64.length*3)/4);
      if (size > 1200000) return json({ error: 'Arquivo muito grande (máx. ~1 MB). Para arquivos maiores, use um link externo.' }, 413);
      await DB.prepare("INSERT INTO docs_files (scope,company_id,project_id,name,mime,size,data_b64,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?,?,datetime('now'))")
        .bind(b.scope||'empresa', b.company_id||'', b.project_id||'', b.name, b.mime||'application/octet-stream', size, b.data_b64, user.name).run();
      await logEvent(env, user, 'doc:upload', b.name, (b.scope||'')+' '+(b.company_id||b.project_id||''));
      return json({ ok: true });
    }
    if (path === 'documents' && request.method === 'GET') {
      const cid = scope || url.searchParams.get('company');
      const pid = url.searchParams.get('project');
      let sql = 'SELECT id,scope,company_id,project_id,name,mime,size,uploaded_by,created_at FROM docs_files WHERE 1=1';
      const bnd = [];
      if (pid) { sql += ' AND project_id = ?'; bnd.push(pid); }
      else if (cid) { sql += ' AND company_id = ?'; bnd.push(cid); }
      sql += ' ORDER BY id DESC';
      return json((await DB.prepare(sql).bind(...bnd).all()).results);
    }
    if (path.startsWith('doc/') && request.method === 'GET') {
      const id = path.split('/')[1];
      const d = await DB.prepare('SELECT name,mime,data_b64,company_id FROM docs_files WHERE id = ?').bind(id).first();
      if (!d) return json({ error: 'Documento não encontrado' }, 404);
      if (scope && d.company_id !== scope) return json({ error: 'Fora do escopo' }, 403);
      const bin = Uint8Array.from(atob(d.data_b64), c=>c.charCodeAt(0));
      return new Response(bin, { headers: { 'content-type': d.mime||'application/octet-stream', 'content-disposition': 'attachment; filename="'+d.name.replace(/"/g,'')+'"' } });
    }
    if (path.startsWith('doc/') && request.method === 'DELETE') {
      if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const id = path.split('/')[1];
      const d = await DB.prepare('SELECT name FROM docs_files WHERE id = ?').bind(id).first();
      if (!d) return json({ error: 'Documento não encontrado' }, 404);
      await DB.prepare('DELETE FROM docs_files WHERE id = ?').bind(id).run();
      await logEvent(env, user, 'doc:excluir', d.name, '');
      return json({ ok: true });
    }

    // DASHBOARD: Curva S consolidada (gestão do instituto)
    if (path === 'dash-curve') {
      if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const rows = (await DB.prepare("SELECT company_id, data_json FROM project_reports_p UNION ALL SELECT company_id, data_json FROM project_reports").all()).results || [];
      const agg = {}; const byCompany = {};
      for (const r of rows) {
        let d; try { d = JSON.parse(r.data_json); } catch(e){ continue; }
        const c = d && d.curve; if (!c || !c.months) continue;
        c.months.forEach((m,i)=>{
          const prev = +c.prev?.[i]||0, real = (c.real&&c.real[i]!=null)?+c.real[i]:null;
          if(!agg[m]) agg[m]={prev:0, real:0, hasReal:false};
          agg[m].prev += prev; if(real!=null){ agg[m].real += real; agg[m].hasReal=true; }
        });
        const cid = r.company_id||'—'; const lastPrev = c.prev?.[c.prev.length-1]||0; const lastReal = (c.real||[]).filter(x=>x!=null).pop();
        if(!byCompany[cid]) byCompany[cid]={prev:0, real:0};
        byCompany[cid].prev += (+lastPrev||0); byCompany[cid].real += (+lastReal||0);
      }
      const months = Object.keys(agg);
      return json({ months, prev: months.map(m=>Math.round(agg[m].prev)), real: months.map(m=>agg[m].hasReal?Math.round(agg[m].real):null), byCompany });
    }

    // ATUALIZAÇÕES recebidas dos gestores (admin/pmo)
    if (path === 'updates' && request.method === 'GET') {
      if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const cid = url.searchParams.get('company');
      let sql = 'SELECT id,company_id,project_id,author,message,status,created_at FROM project_updates';
      const bnd = [];
      if (cid && cid!=='all') { sql += ' WHERE company_id = ?'; bnd.push(cid); }
      sql += ' ORDER BY id DESC LIMIT 100';
      return json((await DB.prepare(sql).bind(...bnd).all()).results);
    }

    // HISTORICO
    if (path === 'audit') {
      if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const rows = await DB.prepare('SELECT ts,actor,role,company_id,action,target,detail FROM audit_log ORDER BY id DESC LIMIT 200').all();
      return json(rows.results);
    }

    // RCA (Análise de Causa Raiz)
    if (path === 'rca' && request.method === 'GET') {
      const rows = await DB.prepare('SELECT * FROM rca' + where + ' ORDER BY id DESC LIMIT 200').bind(...bind).all();
      return json(rows.results);
    }

    // PLANO DE IMPLEMENTAÇÃO (etapas → Curva S)
    if (path === 'plan' && request.method === 'GET') {
      const pid = url.searchParams.get('project') || '';
      const cid = url.searchParams.get('company') || scope || '';
      let sql = 'SELECT * FROM plan_items WHERE 1=1', b = [];
      if (pid) { sql += ' AND project_id = ?'; b.push(pid); }
      else if (cid) { sql += ' AND company_id = ?'; b.push(cid); }
      sql += ' ORDER BY ordem, id';
      const rows = await DB.prepare(sql).bind(...b).all();
      return json(rows.results);
    }
    if (path === 'plan' && request.method === 'POST') {
      if (!['admin','pmo','techlead'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const b = await request.json();
      if (b.id) {
        await DB.prepare('UPDATE plan_items SET fase=?,etapa=?,responsavel=?,owner_tipo=?,horas_prev=?,horas_real=?,inicio=?,fim=?,status=?,ordem=? WHERE id=?')
          .bind(b.fase||'',b.etapa||'',b.responsavel||'',b.owner_tipo||'PMO',+b.horas_prev||0,+b.horas_real||0,b.inicio||'',b.fim||'',b.status||'pendente',+b.ordem||0,b.id).run();
        return json({ ok:true, id:b.id });
      }
      const r = await DB.prepare("INSERT INTO plan_items (company_id,project_id,fase,etapa,responsavel,owner_tipo,horas_prev,horas_real,inicio,fim,status,ordem,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))")
        .bind(b.company_id||'',b.project_id||'',b.fase||'',b.etapa||'',b.responsavel||'',b.owner_tipo||'PMO',+b.horas_prev||0,+b.horas_real||0,b.inicio||'',b.fim||'',b.status||'pendente',+b.ordem||0).run();
      await logEvent(env, user, 'plano:item', b.etapa||'', b.fase||'');
      return json({ ok:true, id: r.meta && r.meta.last_row_id });
    }
    if (path.startsWith('plan/') && request.method === 'DELETE') {
      if (!['admin','pmo','techlead'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      await DB.prepare('DELETE FROM plan_items WHERE id = ?').bind(path.split('/')[1]).run();
      return json({ ok:true });
    }
    if (path === 'rca' && request.method === 'POST') {
      if (!['admin','pmo','techlead'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const b = await request.json();
      if (!b.title) return json({ error: 'Informe o título' }, 400);
      await DB.prepare("INSERT INTO rca (gmud_id,company_id,title,what_happened,impact,root_cause,correction,prevention,status,author,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))")
        .bind(b.gmud_id||'', b.company_id||'', b.title, b.what_happened||'', b.impact||'', b.root_cause||'', b.correction||'', b.prevention||'', b.status||'aberto', user.name).run();
      await logEvent(env, user, 'rca:criar', b.title, (b.gmud_id?('GMUD '+b.gmud_id):'') + ' ' + (b.company_id||''));
      return json({ ok: true });
    }
    if (path.startsWith('rca/') && request.method === 'DELETE') {
      if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const id = path.split('/')[1];
      await DB.prepare('DELETE FROM rca WHERE id = ?').bind(id).run();
      await logEvent(env, user, 'rca:excluir', id, 'RCA removido');
      return json({ ok: true });
    }

    // STATUS REPORT (por projeto quando vem ?project=, senão por empresa)
    if (path === 'report') {
      const pid = url.searchParams.get('project');
      if (pid && !scope) {
        const proj = await DB.prepare('SELECT * FROM projects WHERE id = ?').bind(pid).first();
        if (!proj) return json({ error: 'Projeto não encontrado' }, 404);
        const co = proj.company_id ? await DB.prepare('SELECT * FROM companies WHERE id = ?').bind(proj.company_id).first() : null;
        if (request.method === 'POST') {
          if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
          const body = await request.json();
          const data = body && body.data ? body.data : body;
          const ref = (data && data.ref) || defaultReport(co).ref;
          await DB.prepare("INSERT INTO project_reports_p (project_id, company_id, ref, data_json, updated_at, updated_by) VALUES (?,?,?,?,datetime('now'),?) ON CONFLICT(project_id) DO UPDATE SET ref=excluded.ref, data_json=excluded.data_json, updated_at=datetime('now'), updated_by=excluded.updated_by").bind(pid, proj.company_id||'', ref, JSON.stringify(data), user.name).run();
          await logEvent(env, user, 'report:editar', 'projeto '+proj.name, 'Status Report do projeto atualizado');
          return json({ ok: true });
        }
        const rowp = await DB.prepare('SELECT data_json, ref, updated_at, updated_by FROM project_reports_p WHERE project_id = ?').bind(pid).first();
        if (rowp && rowp.data_json) {
          let data; try { data = JSON.parse(rowp.data_json); } catch (e) { data = defaultReport(co); }
          return json({ data, meta: { ref: rowp.ref, updated_at: rowp.updated_at, updated_by: rowp.updated_by, provisioned: true } });
        }
        const base = defaultReport(co); base.title = 'Governança da Implantação · ' + proj.name; base.client = (co?co.name:'') ;
        return json({ data: base, meta: { provisioned: false } });
      }
      const cid = scope || url.searchParams.get('company');
      if (!cid || cid === 'all') return json({ error: 'Informe a empresa' }, 400);
      const co = await DB.prepare('SELECT * FROM companies WHERE id = ?').bind(cid).first();
      if (!co) return json({ error: 'Empresa não encontrada' }, 404);
      if (request.method === 'POST') {
        if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
        const body = await request.json();
        const data = body && body.data ? body.data : body;
        const ref = (data && data.ref) || defaultReport(co).ref;
        await DB.prepare("INSERT INTO project_reports (company_id, ref, data_json, updated_at, updated_by) VALUES (?,?,?,datetime('now'),?) ON CONFLICT(company_id) DO UPDATE SET ref=excluded.ref, data_json=excluded.data_json, updated_at=datetime('now'), updated_by=excluded.updated_by").bind(cid, ref, JSON.stringify(data), user.name).run();
        await logEvent(env, user, 'report:editar', cid, 'Status Report atualizado');
        return json({ ok: true });
      }
      const row = await DB.prepare('SELECT data_json, ref, updated_at, updated_by FROM project_reports WHERE company_id = ?').bind(cid).first();
      if (row && row.data_json) {
        let data; try { data = JSON.parse(row.data_json); } catch (e) { data = defaultReport(co); }
        return json({ data, meta: { ref: row.ref, updated_at: row.updated_at, updated_by: row.updated_by, provisioned: true } });
      }
      return json({ data: defaultReport(co), meta: { provisioned: false } });
    }

    // ASSISTENTE (Workers AI)
    if (path === 'chat' && request.method === 'POST') {
      const { message, history } = await request.json();
      if (!message) return json({ error: 'Mensagem vazia' }, 400);
      const cWhere = scope ? ' WHERE company_id = ?' : '';
      const cBind = scope ? [scope] : [];
      const companiesSql = (user.role === 'gestor' || user.role === 'usuario')
        ? 'SELECT id,name,city,status_text,pmo_mode,progress FROM companies WHERE id = ?'
        : 'SELECT id,name,city,status_text,pmo_mode,progress FROM companies';
      const [companies, projects, issues, gmud] = await Promise.all([
        DB.prepare(companiesSql).bind(...(scope ? [scope] : [])).all(),
        DB.prepare('SELECT name,company_id,status,pmo_read,note FROM projects' + cWhere).bind(...cBind).all(),
        DB.prepare('SELECT id,title,company_id,status,priority,owner,due_date,flag FROM issues' + cWhere).bind(...cBind).all(),
        DB.prepare('SELECT id,title,company_id,type,risk,status,approver FROM gmud' + cWhere).bind(...cBind).all()
      ]);
      const gmudList = gmud.results || [];
      let curveResumo = null;
      try {
        const rr = (await DB.prepare("SELECT data_json FROM project_reports_p UNION ALL SELECT data_json FROM project_reports").all()).results || [];
        const acc = {};
        for (const r of rr) { let d; try{ d=JSON.parse(r.data_json); }catch(e){ continue; } const c=d&&d.curve; if(!c||!c.months) continue; c.months.forEach((m,i)=>{ if(!acc[m]) acc[m]={prev:0,real:0}; acc[m].prev+=+c.prev?.[i]||0; if(c.real&&c.real[i]!=null) acc[m].real+=+c.real[i]; }); }
        curveResumo = Object.keys(acc).map(m=>({ mes:m, previsto:Math.round(acc[m].prev), realizado:Math.round(acc[m].real) }));
      } catch(e){}
      const gmudResumo = {};
      for (const g of gmudList) { const s=g.status||'—'; gmudResumo[s]=(gmudResumo[s]||0)+1; }
      const iss = issues.results || [];
      const prj = projects.results || [];
      const hoje = new Date().toISOString().slice(0,10);
      const analise = {
        demandas_total: iss.length,
        demandas_vencidas: iss.filter(i=>i.due_date && i.due_date<hoje).length,
        demandas_sem_responsavel: iss.filter(i=>!i.owner || /não|nao/i.test(i.owner)).length,
        demandas_por_prioridade: iss.reduce((a,i)=>{const p=i.priority||'—';a[p]=(a[p]||0)+1;return a;},{}),
        projetos_por_status: prj.reduce((a,p)=>{const s=p.status||'—';a[s]=(a[s]||0)+1;return a;},{}),
        projetos_atencao: prj.filter(p=>/crítico|critico|atenção|atencao/i.test(p.pmo_read||'')).map(p=>({nome:p.name, leitura:p.pmo_read, empresa:p.company_id})),
        empresas_sem_responsavel: (companies.results||[]).filter(c=>!c.lead || /definir/i.test(c.lead)).map(c=>c.name)
      };
      const ctx = { empresas: companies.results, projetos: prj, demandas: iss, gmud: gmudList, gmud_resumo_por_status: gmudResumo, gmud_total: gmudList.length, curva_s_consolidada: curveResumo, analise_pmo: analise };
      const system = [
        'Você é o Copiloto PMO do Instituto Államo — um consultor sênior de gestão de projetos (PMP), analítico e direto.',
        'Responda SEMPRE em português do Brasil. Estruture respostas com títulos curtos, listas e, quando útil, uma conclusão com recomendação.',
        'Você domina: portfólio, demandas, GMUD (gestão de mudanças), Curva S, capacidade/horas, riscos e governança.',
        'Use os dados do contexto (inclui "analise_pmo" já pré-calculada). Cruze informações entre empresas, projetos, demandas e GMUD para tirar conclusões — não apenas repita números. Nunca invente dados; se faltar, diga o que falta e o que seria preciso registrar.',
        'Ao pedir prioridades/o que fazer: entregue de 3 a 6 ações priorizadas (Alta/Média/Baixa), cada uma com o motivo (baseado nos dados) e o impacto esperado.',
        'Ao pedir melhorias/performance: faça um diagnóstico em camadas — (1) saúde do portfólio, (2) gargalos e riscos, (3) governança (GMUD/aprovações), (4) capacidade e Curva S (previsto x realizado), (5) recomendações práticas. Aponte tendências e alerte sobre atrasos.',
        'Ao analisar uma empresa ou projeto específico: traga status, riscos, próximos passos sugeridos e o que precisa de decisão do cliente.',
        'Seja consultivo: quando fizer sentido, sugira boas práticas de PMO (RACI, critérios de aceite, cadência de status, plano de riscos) conectadas ao dado observado.',
        'O usuário atual tem perfil "' + user.role + '"' + (scope ? ' e só enxerga a empresa "' + scope + '".' : ' e enxerga toda a carteira.'),
        'CONTEXTO (JSON): ' + JSON.stringify(ctx)
      ].join('\n');
      const msgs = [{ role: 'system', content: system }];
      if (Array.isArray(history)) for (const h of history.slice(-8)) if (h && h.role && h.content) msgs.push({ role: h.role, content: String(h.content).slice(0, 3000) });
      msgs.push({ role: 'user', content: String(message).slice(0, 3000) });
      try {
        const models = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast','@cf/meta/llama-3.1-8b-instruct-fast','@cf/meta/llama-3.2-3b-instruct','@cf/meta/llama-3-8b-instruct'];
        let reply = '', lastErr = '';
        for (const model of models) {
          try { const ai = await env.AI.run(model, { messages: msgs, max_tokens: 1400, temperature: 0.4 }); reply = (ai && (ai.response || ai.result || '')) || ''; if (reply) break; }
          catch (e) { lastErr = String(e); }
        }
        if (!reply) return json({ error: 'IA indisponível: ' + lastErr }, 502);
        return json({ reply });
      } catch (e) { return json({ error: 'IA indisponível: ' + String(e) }, 502); }
    }

    return json({ error: 'Rota não encontrada' }, 404);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url);
    }
    // qualquer outra rota → serve os arquivos estáticos (o site)
    return env.ASSETS.fetch(request);
  }
};
