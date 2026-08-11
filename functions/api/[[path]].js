// Cloudflare Pages Functions — API do Portal PMO Allamo
// Roteia /api/* ; usa o binding D1 "DB". Controle de acesso por perfil e empresa.

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

async function currentUser(request, env) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return null;
  const s = await env.DB.prepare(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > datetime('now')"
  ).bind(token).first();
  return s || null;
}
// Filtra o escopo: admin/pmo veem tudo; gestor/usuario so a propria empresa
function scopeCompany(user, requested) {
  if (user.role === 'gestor' || user.role === 'usuario') return user.company_id;
  return requested && requested !== 'all' ? requested : null; // null = todas
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '');
  const DB = env.DB;

  try {
    // --- LOGIN (e-mail + senha) ---
    if (path === 'login' && request.method === 'POST') {
      const { email, password } = await request.json();
      const user = await DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
      if (!user || user.status === 'Bloqueado') return json({ error: 'Credenciais inválidas' }, 401);
      const hash = await sha(password + ':' + email);        // sal por e-mail
      if (user.password_hash !== hash) return json({ error: 'Credenciais inválidas' }, 401);
      const token = crypto.randomUUID();
      await DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now','+12 hours'))")
        .bind(token, user.id).run();
      return json({ token, user: { name: user.name, role: user.role, company_id: user.company_id } });
    }

    const user = await currentUser(request, env);
    if (!user) return json({ error: 'Não autenticado' }, 401);
    const scope = scopeCompany(user, url.searchParams.get('company'));
    const where = scope ? ' WHERE company_id = ?' : '';
    const bind = scope ? [scope] : [];

    if (path === 'companies') {
      // gestor/usuario so enxergam a propria empresa
      const sql = (user.role === 'gestor' || user.role === 'usuario')
        ? 'SELECT * FROM companies WHERE id = ?' : 'SELECT * FROM companies ORDER BY name';
      const r = await DB.prepare(sql).bind(...(scope ? [scope] : [])).all();
      return json(r.results);
    }
    if (path === 'projects')  return json((await DB.prepare('SELECT * FROM projects' + where).bind(...bind).all()).results);
    if (path === 'issues')    return json((await DB.prepare('SELECT * FROM issues' + where).bind(...bind).all()).results);
    if (path === 'releases')  return json((await DB.prepare('SELECT * FROM releases' + where + ' ORDER BY rel_date DESC').bind(...bind).all()).results);
    if (path === 'documents') return json((await DB.prepare('SELECT * FROM documents' + where).bind(...bind).all()).results);
    if (path === 'gmud') {
      const sql = 'SELECT * FROM gmud' + where + (scope && (user.role==='gestor'||user.role==='usuario') ? ' AND client_visible = 1' : '');
      return json((await DB.prepare(sql).bind(...bind).all()).results);
    }

    // --- APROVAR / REJEITAR GMUD (admin, pmo, gestor) ---
    if (path.startsWith('gmud/') && request.method === 'POST') {
      if (!['admin','pmo','gestor'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const id = path.split('/')[1];
      const { decision } = await request.json(); // 'Aprovada' | 'Rejeitada'
      const g = await DB.prepare('SELECT * FROM gmud WHERE id = ?').bind(id).first();
      if (!g) return json({ error: 'GMUD não encontrada' }, 404);
      if (scope && g.company_id !== scope) return json({ error: 'Fora do escopo' }, 403);
      await DB.prepare("UPDATE gmud SET status=?, decided_by=?, decided_at=datetime('now') WHERE id=?")
        .bind(decision, user.name, id).run();
      return json({ ok: true, id, status: decision });
    }

    // --- USUARIOS / ACESSOS (somente admin) ---
    if (path === 'users') {
      if (user.role !== 'admin') return json({ error: 'Sem permissão' }, 403);
      return json((await DB.prepare('SELECT id,name,email,role,company_id,status FROM users').all()).results);
    }

    return json({ error: 'Rota não encontrada' }, 404);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
