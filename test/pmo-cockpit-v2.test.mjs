import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortfolioSummary, classifyProjectHealth, displayMetric } from '../src/pmo-cockpit-v2.js';

test('classifica projeto sem report como sem atualização', () => {
  assert.equal(classifyProjectHealth({ status: 'Em andamento' }, null), 'stale');
});

test('risco crítico prevalece sobre status', () => {
  assert.equal(classifyProjectHealth({ status: 'Em andamento', risk_level: 'Crítico' }, { id: 1 }), 'red');
});

test('consolida portfólio sem inventar métricas', () => {
  const projects = [
    { id: 1, status: 'Em andamento' },
    { id: 2, status: 'Atrasado' },
    { id: 3, status: 'Backlog' },
    { id: 4, status: 'Concluído' },
  ];
  const latestReportsByProject = new Map([
    ['1', { id: 'r1' }],
    ['2', { id: 'r2' }],
    ['4', { id: 'r4' }],
  ]);
  const s = buildPortfolioSummary({ companies: [{ id: 'c1' }], projects, latestReportsByProject });
  assert.equal(s.companies, 1);
  assert.equal(s.projects, 4);
  assert.equal(s.inProgress, 1);
  assert.equal(s.delayed, 1);
  assert.equal(s.backlog, 1);
  assert.equal(s.completed, 1);
  assert.equal(s.health.stale, 1);
  assert.equal(s.health.red, 1);
});

test('ausência de métrica não vira zero', () => {
  assert.equal(displayMetric(undefined), 'Não disponível');
  assert.equal(displayMetric(null), 'Não disponível');
  assert.equal(displayMetric(0), 0);
});
