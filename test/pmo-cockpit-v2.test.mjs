import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortfolioSummary, classifyProjectHealth, displayMetric } from '../src/pmo-cockpit-v2.mjs';

const TODAY='2026-09-03';

test('classifica projeto em execução sem report como sem atualização', () => {
  assert.equal(classifyProjectHealth({ status: 'Em andamento', pmo_read: '' }, null, TODAY), 'stale');
});

test('leitura PMO crítica prevalece e gera vermelho', () => {
  assert.equal(classifyProjectHealth({ status: 'Em andamento', pmo_read: 'Crítico' }, { id: 1 }, TODAY), 'red');
});

test('meta_date vencida gera vermelho sem depender de interpretação manual', () => {
  assert.equal(classifyProjectHealth({ status: 'Em andamento', pmo_read: 'Estável', meta_date: '2026-09-02' }, { id: 1 }, TODAY), 'red');
});

test('backlog não é tratado como projeto sem atualização', () => {
  assert.equal(classifyProjectHealth({ status: 'Backlog' }, null, TODAY), 'not_applicable');
});

test('consolida portfólio com pmo_read, meta_date e report real', () => {
  const projects = [
    { id: 1, status: 'Em andamento', pmo_read: 'Estável', meta_date: '2026-09-30' },
    { id: 2, status: 'Em andamento', pmo_read: 'Atenção', meta_date: '2026-09-30' },
    { id: 3, status: 'Em andamento', pmo_read: 'Estável', meta_date: '2026-09-02' },
    { id: 4, status: 'Backlog', pmo_read: '' },
    { id: 5, status: 'Completo', pmo_read: '' },
  ];
  const latestReportsByProject = new Map([
    ['1', { id: 'r1' }],
    ['2', { id: 'r2' }],
    ['3', { id: 'r3' }],
  ]);
  const s = buildPortfolioSummary({ companies: [{ id: 'c1' }], projects, latestReportsByProject, today: TODAY });
  assert.equal(s.companies, 1);
  assert.equal(s.projects, 5);
  assert.equal(s.inProgress, 3);
  assert.equal(s.atRisk, 1);
  assert.equal(s.delayed, 1);
  assert.equal(s.backlog, 1);
  assert.equal(s.completed, 1);
  assert.equal(s.health.green, 1);
  assert.equal(s.health.yellow, 1);
  assert.equal(s.health.red, 1);
  assert.equal(s.health.not_applicable, 2);
});

test('ausência de métrica não vira zero', () => {
  assert.equal(displayMetric(undefined), 'Não disponível');
  assert.equal(displayMetric(null), 'Não disponível');
  assert.equal(displayMetric(0), 0);
});
