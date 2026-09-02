import test from 'node:test';
import assert from 'node:assert/strict';
import { processInboundChannelMessage } from '../src/intake.mjs';

class FakeDb {
  constructor({systemKind='external',phase='support',existing=null}={}) {
    this.channel={id:'chn:1',tenant_id:'tenant-a',project_id:'project-a',system_id:'sys:1',provider:'whatsapp',name:'Grupo A'};
    this.system={id:'sys:1',tenant_id:'tenant-a',project_id:'project-a',name:'Sistema A',system_kind:systemKind,lifecycle_phase:phase,official_ticket_source:systemKind==='sallamos'?'sallamos':'allamo'};
    this.existing=existing;
    this.calls=[];
  }
  prepare(sql){return new FakeStatement(this,sql);}
}
class FakeStatement {
  constructor(db,sql){this.db=db;this.sql=sql.replace(/\s+/g,' ').trim();this.args=[];}
  bind(...args){this.args=args;return this;}
  async first(){
    this.db.calls.push({type:'first',sql:this.sql,args:this.args});
    if(this.sql.includes('FROM service_hub_channels')&&this.sql.includes('provider=?'))return this.db.channel;
    if(this.sql.includes('FROM service_hub_messages')&&this.sql.includes('provider_message_id=?'))return this.db.existing;
    if(this.sql.includes('FROM service_hub_systems')&&this.sql.includes('active=1'))return this.db.system;
    if(this.sql.startsWith('SELECT id FROM service_hub_systems'))return {id:this.db.system.id};
    if(this.sql.startsWith('SELECT id FROM service_hub_channels'))return {id:this.db.channel.id};
    if(this.sql.includes('FROM service_hub_sla_policies'))return null;
    return null;
  }
  async run(){this.db.calls.push({type:'run',sql:this.sql,args:this.args});return {success:true};}
  async all(){this.db.calls.push({type:'all',sql:this.sql,args:this.args});return {results:[]};}
}

const base={provider:'whatsapp',externalChannelId:'grupo-a',providerMessageId:'wa-1',senderRefHash:'hash:sender',occurredAt:'2026-09-01T12:00:00Z'};

test('dúvida é registrada sem abrir ticket local',async()=>{
  const db=new FakeDb({systemKind:'external',phase:'support'});
  const r=await processInboundChannelMessage({DB:db},{...base,text:'Onde encontro a configuração de forma de pagamento?'});
  assert.equal(r.classification.messageType,'question');
  assert.equal(r.route.destination,'valkiria');
  assert.equal(r.ticket,null);
  assert.equal(r.nextAction,'valkiria_answer_or_clarify');
  assert.ok(db.calls.some(c=>c.type==='run'&&c.sql.includes('INSERT INTO service_hub_messages')));
  assert.ok(!db.calls.some(c=>c.type==='run'&&c.sql.includes('INSERT INTO service_hub_tickets')));
});

test('incidente de sistema externo em sustentação abre ticket Államo',async()=>{
  const db=new FakeDb({systemKind:'external',phase:'support'});
  const r=await processInboundChannelMessage({DB:db},{...base,providerMessageId:'wa-2',text:'O Power BI não atualiza os dados hoje'});
  assert.equal(r.classification.messageType,'incident');
  assert.equal(r.route.destination,'allamo_service_desk');
  assert.ok(r.ticket?.id);
  assert.equal(r.nextAction,'allamo_ticket_created');
  assert.ok(db.calls.some(c=>c.type==='run'&&c.sql.includes('INSERT INTO service_hub_tickets')));
  assert.ok(db.calls.some(c=>c.type==='run'&&c.sql.includes('UPDATE service_hub_messages')));
});

test('incidente Sallamos em produção não cria segunda verdade local',async()=>{
  const db=new FakeDb({systemKind:'sallamos',phase:'production'});
  const r=await processInboundChannelMessage({DB:db},{...base,providerMessageId:'wa-3',text:'Erro ao emitir a guia no sistema'});
  assert.equal(r.route.destination,'sallamos');
  assert.equal(r.route.ticketRequired,true);
  assert.equal(r.ticket,null);
  assert.equal(r.nextAction,'handoff_to_sallamos');
  assert.ok(!db.calls.some(c=>c.type==='run'&&c.sql.includes('INSERT INTO service_hub_tickets')));
});

test('retry do mesmo providerMessageId é idempotente',async()=>{
  const existing={id:'msg:old',ticket_id:'tkt:old',message_type:'incident',confidence:0.9,occurred_at:'2026-09-01T12:00:00Z'};
  const db=new FakeDb({existing});
  const r=await processInboundChannelMessage({DB:db},{...base,text:'Erro novamente'});
  assert.equal(r.duplicate,true);
  assert.equal(r.messageId,'msg:old');
  assert.equal(r.ticketId,'tkt:old');
  assert.equal(r.nextAction,'already_processed');
  assert.ok(!db.calls.some(c=>c.type==='run'));
});
