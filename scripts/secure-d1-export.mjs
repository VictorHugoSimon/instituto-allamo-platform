import { spawnSync } from 'node:child_process';

export function sanitizeD1ExportLog(text = '') {
  return String(text)
    .replace(/https?:\/\/\S+/g, '[redacted-temporary-url]')
    .replace(/X-Amz-[A-Za-z-]+=[^\s&]+/gi, 'X-Amz-REDACTED=[redacted]');
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  const sample = 'Download: https://example.r2.cloudflarestorage.com/a.sql?X-Amz-Signature=secret&X-Amz-Expires=3600';
  const safe = sanitizeD1ExportLog(sample);
  if (safe.includes('https://') || safe.includes('secret')) throw new Error('Redaction self-test failed');
  console.log('OK: D1 export log redaction removes temporary signed URLs.');
  process.exit(0);
}

const configIndex = args.indexOf('--config');
const outputIndex = args.indexOf('--output');
if (configIndex < 0 || !args[configIndex + 1] || outputIndex < 0 || !args[outputIndex + 1]) {
  console.error('Usage: node scripts/secure-d1-export.mjs --config <wrangler.toml> --output <backup.sql>');
  process.exit(2);
}

const config = args[configIndex + 1];
const output = args[outputIndex + 1];
const result = spawnSync('npx', ['wrangler@4.124.0', 'd1', 'export', 'DB', '--remote', '--config', config, `--output=${output}`], {
  encoding: 'utf8',
  env: process.env,
  shell: process.platform === 'win32'
});

const combined = [result.stdout, result.stderr].filter(Boolean).join('\n');
if (combined) process.stdout.write(sanitizeD1ExportLog(combined));
if (result.error) console.error('D1 export process error:', result.error.message);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`\nOK: D1 backup exported to ${output}; temporary download URL omitted from logs.`);
