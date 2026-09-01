import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyServiceMessage } from '../src/classifier.mjs';

test('saudação simples não vira chamado',()=>{
  const r=classifyServiceMessage('Bom dia!');
  assert.equal(r.messageType,'social');
  assert.equal(r.actionable,false);
  assert.ok(r.confidence>0.9);
});

test('queda geral é incidente crítico',()=>{
  const r=classifyServiceMessage('O sistema caiu em produção e ninguém consegue acessar');
  assert.equal(r.messageType,'incident');
  assert.equal(r.priority,'critical');
  assert.equal(r.actionable,true);
});

test('erro funcional é incidente',()=>{
  const r=classifyServiceMessage('O Power BI não atualiza os dados hoje');
  assert.equal(r.messageType,'incident');
  assert.equal(r.actionable,true);
  assert.ok(['medium','high'].includes(r.priority));
});

test('pergunta operacional é dúvida',()=>{
  const r=classifyServiceMessage('Onde encontro a configuração de forma de pagamento?');
  assert.equal(r.messageType,'question');
  assert.equal(r.actionable,false);
});

test('mudança de regra é change',()=>{
  const r=classifyServiceMessage('Precisamos alterar regra de aprovação do pedido');
  assert.equal(r.messageType,'change');
  assert.equal(r.actionable,true);
});

test('decisão registrada não abre chamado',()=>{
  const r=classifyServiceMessage('Ficou definido que a homologação será feita pelo cliente');
  assert.equal(r.messageType,'decision');
  assert.equal(r.actionable,false);
});

test('ação ambígua cai em revisão',()=>{
  const r=classifyServiceMessage('Favor validar isso com o time');
  assert.equal(r.messageType,'context');
  assert.equal(r.needsReview,true);
  assert.ok(r.confidence<0.65);
});
