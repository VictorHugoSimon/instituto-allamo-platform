const arg = name => {
  const p = process.argv.find(x => x.startsWith(`--${name}=`));
  return p ? p.slice(name.length + 3) : '';
};
const stage = (arg('stage') || process.env.ALLAMO_STAGE_URL || 'https://allamo-pmo-stage.pages.dev').replace(/\/$/, '');
const production = (arg('production') || process.env.ALLAMO_PRODUCTION_URL || 'https://allamo-pmo.pages.dev').replace(/\/$/, '');
const requiredTenants = [['dualclima','Dual Clima'],['madrid','Madrid'],['opr','OPR']];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(base, path, attempts = 5) {
  let last = '';
  for (let i = 1; i <= attempts; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const r = await fetch(base + path, {
        method: 'GET',
        headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timer);
      const text = await r.text();
      if (r.ok) {
        try { return JSON.parse(text); }
        catch { last = `JSON inválido: ${text.slice(0, 160)}`; }
      } else {
        last = `HTTP ${r.status}: ${text.slice(0, 160)}`;
      }
    } catch (e) {
      last = String(e?.name === 'AbortError' ? 'timeout' : (e?.message || e));
    }
    if (i < attempts) await sleep(2500);
  }
  throw new Error(`${base}${path} indisponível após ${attempts} tentativas: ${last}`);
}

async function checkEnvironment(name, base, stageMode = false) {
  const release = await getJson(base, '/release.json');
  if (!/^[0-9a-f]{40}$/i.test(String(release?.sha || ''))) throw new Error(`${name}: release.json sem SHA válido.`);
  if (!String(release?.release || '').startsWith('awm-')) throw new Error(`${name}: fingerprint de release inválido.`);

  const companies = await getJson(base, '/api/companies');
  if (!Array.isArray(companies)) throw new Error(`${name}: /api/companies não retornou array.`);
  const projects = await getJson(base, '/api/projects');
  if (!Array.isArray(projects)) throw new Error(`${name}: /api/projects não retornou array.`);

  const companyIds = new Set(companies.map(c => String(c.id)));
  const orphan = projects.filter(p => p.company_id && !companyIds.has(String(p.company_id)));
  if (orphan.length) throw new Error(`${name}: ${orphan.length} projeto(s) órfão(s) de empresa.`);

  const publicContexts = [];
  for (const [token, expectedName] of requiredTenants) {
    const data = await getJson(base, '/api/public-client-projects?company=' + encodeURIComponent(token));
    if (!data?.company || String(data.company.name) !== expectedName) {
      throw new Error(`${name}: tenant público ${token} não resolveu para ${expectedName}.`);
    }
    const cid = String(data.company.id);
    const crossed = (data.projects || []).filter(p => String(p.company_id) !== cid);
    if (crossed.length) throw new Error(`${name}: cruzamento de tenant detectado em ${expectedName}.`);
    publicContexts.push({ token, company: expectedName, project_count: (data.projects || []).length });
  }

  let stageHealth = null;
  if (stageMode) {
    stageHealth = await getJson(base, '/api/stage-health');
    if (stageHealth?.ok !== true) throw new Error('Stage: /api/stage-health não está saudável.');
    if (stageHealth?.reset_disabled !== true) throw new Error('Stage: proteção contra reset não confirmada.');
    if (stageHealth?.data_persistence !== 'persistent') throw new Error('Stage: persistência de dados não confirmada.');
  }

  return {
    name,
    base,
    release: release.release,
    sha: release.sha,
    company_count: companies.length,
    project_count: projects.length,
    public_contexts: publicContexts,
    stage_persistence: stageHealth ? {
      persistent: stageHealth.data_persistence,
      reset_disabled: stageHealth.reset_disabled
    } : undefined
  };
}

const started = new Date().toISOString();
const results = [];
results.push(await checkEnvironment('stage', stage, true));
results.push(await checkEnvironment('production', production, false));
console.log(JSON.stringify({ ok: true, checked_at: started, results }, null, 2));
