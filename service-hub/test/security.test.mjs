import test from 'node:test';
import assert from 'node:assert/strict';
import { redactServiceText } from '../src/redact.mjs';
import { normalizeContext, requirePermission } from '../src/api.mjs';

test('redacta email, CPF, telefone e segredo',()=>{
  const r=redactServiceText('Contato joao@example.com CPF 123.456.789-00 tel (18) 99999-8888 token=abc123');
  assert.equal(r.redacted,true);
  assert.match(r.text,/\[EMAIL_REDACTED\]/);
  assert.match(r.text,/\[CPF_REDACTED\]/);
  assert.match(r.text,/\[PHONE_REDACTED\]/);
  assert.match(r.text,/\[SECRET_REDACTED\]/);
  assert.doesNotMatch(r.text,/joao@example.com/);
});

test('contexto exige tenant',()=>{
  assert.throws(()=>normalizeContext({permissions:['service_hub:read']}),/tenant_required/);
});

test('permissionamento é explícito',()=>{
  const ctx=normalizeContext({tenantId:'tenant-a',permissions:['service_hub:read']});
  assert.doesNotThrow(()=>requirePermission(ctx,'service_hub:read'));
  assert.throws(()=>requirePermission(ctx,'service_hub:write'),/forbidden/);
});

test('wildcard do módulo permite operações',()=>{
  const ctx=normalizeContext({tenantId:'tenant-a',permissions:['service_hub:*']});
  assert.doesNotThrow(()=>requirePermission(ctx,'service_hub:configure'));
});
