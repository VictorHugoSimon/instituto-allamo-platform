import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../scripts/provision.mjs',import.meta.url),'utf8');
const pos={
  whoami:source.indexOf("run(['whoami'])"),
  d1List:source.indexOf("run(['d1','list'])"),
  vectorList:source.indexOf("run(['vectorize','list'])"),
  r2List:source.indexOf("run(['r2','bucket','list'])"),
  d1Create:source.indexOf("run(['d1','create',spec.db])"),
  vectorCreate:source.indexOf("run(['vectorize','create',spec.vector"),
  r2Create:source.indexOf("tryRun(['r2','bucket','create',spec.bucket])")
};
for(const [name,index] of Object.entries(pos)) if(index<0) throw new Error(`Marcador ausente no provisionador: ${name}`);
const lastRead=Math.max(pos.whoami,pos.d1List,pos.vectorList,pos.r2List);
const firstMutation=Math.min(pos.d1Create,pos.vectorCreate,pos.r2Create);
if(!(lastRead<firstMutation)) throw new Error(`Provisionamento pode mutar Cloudflare antes de validar capacidades: ${JSON.stringify(pos)}`);
if(source.indexOf("environment==='production'")>source.indexOf("run(['whoami'])")) throw new Error('Gate de produção deve ocorrer antes de qualquer chamada Cloudflare.');
console.log('PROVISION_SAFETY_OK: capacidades D1/Vectorize/R2 são validadas antes da primeira criação.');
