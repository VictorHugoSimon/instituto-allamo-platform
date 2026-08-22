#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
const run=promisify(execFile), DB='sallamos-ai-meta';
const IGNORE=['node_modules','dist','build','.git','vendor','coverage','.next','public/assets','__snapshots__'];
const IGNORE_FILE=/(\.min\.|\.map$|\.lock$|\.env|secret|dump|\.sql\.gz$)/i; const CODE_EXT=['.ts','.tsx','.js','.jsx','.vue','.php','.sql'];
const args=parseArgs(process.argv.slice(2)); const repo=args.repo; if(!repo){console.error('uso: ingest-repo.mjs --repo <path> --branch <branch> [--module <m>]');process.exit(1)}
const commit=(await run('git',['-C',repo,'rev-parse','HEAD'])).stdout.trim(); const shortSha=commit.slice(0,7);
await sql('INSERT INTO repo_snapshot (id,repository,branch,commit_sha,release,indexed_at,status) VALUES (?,?,?,?,?,?,?)',[crypto.randomUUID(),repo,args.branch??'main',commit,args.release??null,new Date().toISOString(),'indexando']);
const entries=await readdir(repo,{recursive:true,withFileTypes:true});
const files=entries.filter(d=>d.isFile()).map(d=>relative(repo,join(d.parentPath??d.path,d.name))).filter(p=>!IGNORE.some(i=>p.includes(i))).filter(p=>!IGNORE_FILE.test(p)).filter(p=>CODE_EXT.includes(extname(p))).filter(p=>!args.module||p.toLowerCase().includes(args.module.toLowerCase()));
let symbols=0;
for(const file of files){const src=await readFile(join(repo,file),'utf8');if(src.length>400000)continue;const docId='code:'+file;await sql(`INSERT INTO knowledge_document (id,source_type,title,module,version,owner,status,source_uri,content_hash,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET content_hash=excluded.content_hash,updated_at=excluded.updated_at`,[docId,'code',file,args.module??null,shortSha,args.owner??null,'indexado',file,sha(src),new Date().toISOString()]);await sql('DELETE FROM chunk_fts WHERE chunk_id IN (SELECT id FROM knowledge_chunk WHERE document_id=?)',[docId]);for(const [i,unit] of chunkByUnit(src).entries()){const chunkId=docId+'#'+i;await sql(`INSERT INTO knowledge_chunk (id,document_id,chunk_index,text,symbol,path,commit_sha,module,version,hash,embedded) VALUES (?,?,?,?,?,?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET text=excluded.text,hash=excluded.hash,embedded=0`,[chunkId,docId,i,unit.text,unit.symbol,file,shortSha,args.module??null,shortSha,sha(unit.text)]);await sql('INSERT INTO chunk_fts (text,symbol,path,chunk_id) VALUES (?,?,?,?)',[unit.text,unit.symbol,file,chunkId]);symbols++;}}
console.log('arquivos: '+files.length+' · unidades: '+symbols+' · commit '+shortSha);
function chunkByUnit(src){const DECL=/^(export\s+)?(async\s+)?(function|class|const|interface|type|def|public|private)\s+([A-Za-z0-9_$]+)/;const lines=src.split('\n'),out=[];let buf=[],symbol='module';for(const line of lines){const m=line.match(DECL);if(m&&buf.join('\n').trim().length>200){out.push({symbol,text:buf.join('\n')});buf=[]}if(m)symbol=m[4];buf.push(line);if(buf.length>120){out.push({symbol,text:buf.join('\n')});buf=[]}}if(buf.join('\n').trim())out.push({symbol,text:buf.join('\n')});return out.filter(u=>u.text.trim().length>120)}
function parseArgs(argv){const o={};for(let i=0;i<argv.length;i+=2)o[argv[i].replace(/^--/,'')]=argv[i+1];return o} const sha=s=>createHash('sha256').update(s).digest('hex').slice(0,16);
async function sql(query,params){const copy=[...params];const bound=query.replace(/\?/g,()=>quote(copy.shift()));await run(process.platform==='win32'?'npx.cmd':'npx',['wrangler','d1','execute',DB,'--remote','--command',bound])} function quote(v){if(v===null||v===undefined)return'NULL';if(typeof v==='number')return String(v);return"'"+String(v).replace(/'/g,"''")+"'"}
