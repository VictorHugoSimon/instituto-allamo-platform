import fs from 'node:fs';

const file = process.argv[2] || 'npm-audit.json';
if (!fs.existsSync(file)) throw new Error(`Arquivo de audit não encontrado: ${file}`);

const audit = JSON.parse(fs.readFileSync(file, 'utf8'));
const meta = audit.metadata?.vulnerabilities || {};
const vulns = audit.vulnerabilities || {};
const rows = Object.entries(vulns).map(([name, v]) => {
  const via = Array.isArray(v.via)
    ? v.via.map(x => typeof x === 'string' ? x : `${x.source || ''}:${x.title || ''}`).filter(Boolean)
    : [];
  const fix = v.fixAvailable === true
    ? 'sim'
    : v.fixAvailable && typeof v.fixAvailable === 'object'
      ? `${v.fixAvailable.name || name}@${v.fixAvailable.version || '?'}${v.fixAvailable.isSemVerMajor ? ' (major)' : ''}`
      : 'não';
  return {
    name,
    severity: v.severity || 'unknown',
    direct: !!v.isDirect,
    range: v.range || '',
    fix,
    via: via.join(' | ')
  };
});

const order = { critical: 5, high: 4, moderate: 3, low: 2, info: 1, unknown: 0 };
rows.sort((a, b) => (order[b.severity] || 0) - (order[a.severity] || 0) || Number(b.direct) - Number(a.direct) || a.name.localeCompare(b.name));

const lines = [];
lines.push('# NPM Audit Controlado');
lines.push('');
lines.push(`- total: ${meta.total ?? rows.length}`);
lines.push(`- critical: ${meta.critical ?? 0}`);
lines.push(`- high: ${meta.high ?? 0}`);
lines.push(`- moderate: ${meta.moderate ?? 0}`);
lines.push(`- low: ${meta.low ?? 0}`);
lines.push('');
lines.push('| Pacote | Severidade | Direta | Range | Correção disponível | Via |');
lines.push('|---|---|---:|---|---|---|');
for (const r of rows) {
  const esc = s => String(s ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
  lines.push(`| ${esc(r.name)} | ${esc(r.severity)} | ${r.direct ? 'sim' : 'não'} | ${esc(r.range)} | ${esc(r.fix)} | ${esc(r.via)} |`);
}
lines.push('');
lines.push('> Este relatório é somente diagnóstico. Nenhum `npm audit fix` ou `--force` é executado.');

const out = lines.join('\n') + '\n';
fs.writeFileSync('npm-audit-summary.md', out);
console.log(out);

if ((meta.critical || 0) > 0) process.exitCode = 2;
