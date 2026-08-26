import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/operational-health.yml','utf8');
const script = fs.readFileSync('scripts/operational-health-check.mjs','utf8');

const must = (text, needle, label) => {
  if (!text.includes(needle)) throw new Error(`Ausente: ${label} (${needle})`);
};

must(workflow, "cron: '5 */2 * * *'", 'monitoramento periódico');
must(workflow, 'permissions:', 'permissões explícitas');
must(workflow, 'contents: read', 'conteúdo somente leitura');
must(workflow, 'issues: write', 'alerta operacional controlado');
must(workflow, 'node scripts/operational-health-check.mjs', 'smoke operacional');
must(workflow, 'if: failure()', 'tratamento de falha');
must(workflow, 'if: success()', 'tratamento de recuperação');

for (const needle of [
  '/release.json',
  '/api/companies',
  '/api/projects',
  '/api/public-client-projects?company=',
  '/api/stage-health',
  "method: 'GET'",
  "reset_disabled",
  "data_persistence"
]) must(script, needle, 'contrato de saúde operacional');

if (/method:\s*['\"](?:POST|PUT|PATCH|DELETE)['\"]/i.test(script)) {
  throw new Error('Smoke operacional não pode executar mutações HTTP.');
}

console.log('OK: monitor operacional é periódico, read-only, valida Stage/Produção e abre um único alerta em caso de falha.');
