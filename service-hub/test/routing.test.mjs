import test from 'node:test';
import assert from 'node:assert/strict';
import { routeServiceHub } from '../src/routing.mjs';

const base={tenantId:'tenant-a',projectId:'project-a'};

test('dúvida vai para Valkíria sem abrir chamado',()=>{
  const r=routeServiceHub({...base,systemKind:'sallamos',phase:'implementation',messageType:'question'});
  assert.equal(r.destination,'valkiria');
  assert.equal(r.ticketRequired,false);
});

test('Sallamos em produção usa Sallamos como origem oficial',()=>{
  const r=routeServiceHub({...base,systemKind:'sallamos',phase:'production',messageType:'incident'});
  assert.equal(r.destination,'sallamos');
  assert.equal(r.ticketRequired,true);
  assert.equal(r.official,true);
});

test('Sallamos em implantação mantém ticket na fila de projeto',()=>{
  const r=routeServiceHub({...base,systemKind:'sallamos',phase:'implementation',messageType:'blocker'});
  assert.equal(r.destination,'project_queue');
  assert.equal(r.ticketRequired,true);
});

test('sistema externo em sustentação usa Államo Service Desk',()=>{
  const r=routeServiceHub({...base,systemKind:'external',phase:'support',messageType:'incident'});
  assert.equal(r.destination,'allamo_service_desk');
  assert.equal(r.ticketRequired,true);
  assert.equal(r.official,true);
});

test('contexto social não abre chamado',()=>{
  const r=routeServiceHub({...base,systemKind:'external',phase:'implementation',messageType:'social'});
  assert.equal(r.destination,'context_only');
  assert.equal(r.ticketRequired,false);
});

test('projeto encerrado exige revisão humana para incidente',()=>{
  const r=routeServiceHub({...base,systemKind:'external',phase:'closed',messageType:'incident'});
  assert.equal(r.destination,'human_review');
  assert.equal(r.ticketRequired,true);
});

test('rejeita ausência de tenant/projeto',()=>{
  assert.throws(()=>routeServiceHub({systemKind:'external',phase:'support',messageType:'incident'}),/tenant_and_project_required/);
});
