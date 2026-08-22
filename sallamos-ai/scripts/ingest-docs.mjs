#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join, extname, basename } from 'node:path';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
const run = promisify(execFile); const DB = 'sallamos-ai-meta'; const MAX_CHARS = 1200;
const dir = process.argv[2]; if (!dir) { console.error('uso: ingest-docs.mjs <diretorio>'); process.exit(1); }
const files = (await readdir(dir, { recursive: true })).filter(f => ['.md','.txt'].includes(extname(f)));
let docs=0,chunks=0;
for (const file of files) {
  const raw = await readFile(join(dir,file),'utf8'); const {meta,body}=parseFrontMatter(raw);
  const docId='doc:'+file.replace(/\.(md|txt)$/,''); const hash=sha(body);
  await sql(`INSERT INTO knowledge_document (id,source_type,title,module,version,owner,status,source_uri,content_hash,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET content_hash=excluded.content_hash,updated_at=excluded.updated_at`,[docId,'doc',meta.title??basename(file),meta.module??null,meta.version??null,meta.owner??null,meta.owner?(meta.status??'rascunho'):'sem_owner',file,hash,new Date().toISOString()]);
  await sql('DELETE FROM chunk_fts WHERE chunk_id IN (SELECT id FROM knowledge_chunk WHERE document_id=?)',[docId]);
  const parts=splitBySection(body);
  for (const [i,text] of parts.entries()) { const chunkId=docId+'#'+i; await sql(`INSERT INTO knowledge_chunk (id,document_id,chunk_index,text,module,version,hash,embedded) VALUES (?,?,?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET text=excluded.text,hash=excluded.hash,embedded=0`,[chunkId,docId,i,text,meta.module??null,meta.version??null,sha(text)]); await sql('INSERT INTO chunk_fts (text,symbol,path,chunk_id) VALUES (?,?,?,?)',[text,'',file,chunkId]); chunks++; }
  docs++;
}
console.log('documentos: '+docs+' · chunks: '+chunks); console.log('agora rode o reindex para gerar embeddings');
function parseFrontMatter(raw){const m=raw.match(/^---\n([\s\S]*?)\n---\n?/);if(!m)return{meta:{},body:raw};const meta={};for(const line of m[1].split('\n')){const i=line.indexOf(':');if(i>0)meta[line.slice(0,i).trim()]=line.slice(i+1).trim();}return{meta,body:raw.slice(m[0].length)}}
function splitBySection(body){const out=[];let buf='';for(const line of body.split('\n')){if(/^#{1,3}\s/.test(line)&&buf.length>300){out.push(buf.trim());buf='';}buf+=line+'\n';if(buf.length>MAX_CHARS){out.push(buf.trim());buf='';}}if(buf.trim())out.push(buf.trim());return out.filter(t=>t.length>80)}
const sha=s=>createHash('sha256').update(s).digest('hex').slice(0,16);
async function sql(query,params){const copy=[...params];const bound=query.replace(/\?/g,()=>quote(copy.shift()));await run(NPX(),['wrangler','d1','execute',DB,'--remote','--command',bound]);}
function NPX(){return process.platform==='win32'?'npx.cmd':'npx'}
function quote(v){if(v===null||v===undefined)return'NULL';if(typeof v==='number')return String(v);return"'"+String(v).replace(/'/g,"''")+"'"}
