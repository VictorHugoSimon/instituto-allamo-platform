import test from 'node:test';
import assert from 'node:assert/strict';
import { createServiceHubRepository } from '../src/repository.mjs';

class FakeDb{
  constructor(){this.calls=[];}
  prepare(sql){return new FakeStatement(this,sql);}
}
class FakeStatement{
  constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async all(){this.db.calls.push({type:'all',sql:this.sql,args:this.args});return{results:[]};}
  async first(){this.db.calls.push({type:'first',sql:this.sql,args:this.args});return null;}
  async run(){this.db.calls.push({type:'run',sql:this.sql,args:this.args});return{success:true};}
}

const ctx={tenantId:'tenant-a',permissions:['service_hub:*'],actorType:'user',actorRef:'user-a'};

test('listagem de sistemas sempre inicia por tenant',async()=>{
  const db=new FakeDb(),repo=createServiceHubRepository(db);
  await repo.listSystems(ctx,{projectId:'project-a'});
  assert.match(db.calls[0].sql,/WHERE tenant_id=\?/);
  assert.equal(db.calls[0].args[0],'tenant-a');
  assert.equal(db.calls[0].args[1],'project-a');
});

test('listagem de tickets é tenant-scoped',async()=>{
  const db=new FakeDb(),repo=createServiceHubRepository(db);
  await repo.listTickets(ctx,{status:'new',limit:25});
  assert.match(db.calls[0].sql,/WHERE tenant_id=\?/);
  assert.equal(db.calls[0].args[0],'tenant-a');
  assert.equal(db.calls[0].args.at(-1),25);
});

test('criação de sistema persiste tenant do contexto, nunca do payload',async()=>{
  const db=new FakeDb(),repo=createServiceHubRepository(db);
  const result=await repo.createSystem(ctx,{tenantId:'tenant-invasor',projectId:'project-a',name:'ERP',systemKind:'external',lifecyclePhase:'implementation',officialTicketSource:'project_queue'});
  const insert=db.calls.find(c=>c.sql.includes('INSERT INTO service_hub_systems'));
  assert.ok(insert);
  assert.equal(insert.args[1],'tenant-a');
  assert.equal(result.tenantId,'tenant-a');
});
