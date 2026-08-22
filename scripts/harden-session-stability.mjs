import fs from 'node:fs';

const indexFile='public/index.html';
const workerFile='public/_worker.js';
const sessionApi=fs.readFileSync('src/session-stability-api.js','utf8');

// ---- Worker: sessão de 7 dias + endpoint dedicado + logout revogável ----
let worker=fs.readFileSync(workerFile,'utf8');
worker=worker.split("datetime('now','+12 hours')").join("datetime('now','+7 days')");
if(!worker.includes("datetime('now','+7 days')")) throw new Error('TTL de sessão de 7 dias não encontrado.');

const start='    // BEGIN ALLAMO SESSION STABILITY';
const end='    // END ALLAMO SESSION STABILITY';
const needle="    const scope = scopeCompany(user, url.searchParams.get('company'));";
const block=start+'\n'+sessionApi.split('\n').map(x=>'    '+x).join('\n')+'\n'+end;
if(worker.includes(start)){
  const a=worker.indexOf(start),b=worker.indexOf(end,a);
  if(b<0) throw new Error('Marcador final da sessão ausente.');
  worker=worker.slice(0,a)+block+worker.slice(b+end.length);
}else{
  if(!worker.includes(needle)) throw new Error('Ponto de injeção da sessão não encontrado no Worker.');
  worker=worker.replace(needle,block+'\n'+needle);
}
fs.writeFileSync(workerFile,worker);

// ---- Portal: edita o template JÁ DECODIFICADO e reserializa via JSON.stringify ----
// O public/index.html contém a aplicação dentro de <script type="__bundler/template"> como JSON.
// Nunca inserir JavaScript diretamente na string JSON bruta: qualquer barra/escape pode invalidar o bundle.
let html=fs.readFileSync(indexFile,'utf8');
const templateOpen='<script type="__bundler/template">';
const templateClose='</script>';
const tagStart=html.indexOf(templateOpen);
if(tagStart<0) throw new Error('Template do bundler não encontrado.');
const jsonStart=tagStart+templateOpen.length;
const jsonEnd=html.indexOf(templateClose,jsonStart);
if(jsonEnd<0) throw new Error('Fechamento do template do bundler não encontrado.');
const encodedTemplate=html.slice(jsonStart,jsonEnd);
let template;
try{ template=JSON.parse(encodedTemplate); }
catch(err){ throw new Error('Bundle-base já chegou com JSON inválido: '+String(err&&err.message||err)); }
if(typeof template!=='string') throw new Error('Template do bundler não é uma string JSON.');

const restoreStart=template.indexOf('restoreSession() {');
const nextMethod='  async onLoginSubmit(e) {';
const restoreEnd=template.indexOf(nextMethod,restoreStart);
if(restoreStart<0||restoreEnd<0) throw new Error('Limites de restoreSession não encontrados no template decodificado.');

const stableRestore=[
  'restoreSession() {',
  '    let sess = null;',
  "    try { sess = JSON.parse(localStorage.getItem('allamo_session') || 'null'); } catch(e){}",
  '    if (!sess || !sess.token) return;',
  '    // restaura imediatamente; valida autenticação em endpoint dedicado sem derrubar sessão por falha de rede',
  '    this.setState({',
  "      token: sess.token, live: true, role: sess.role, screen: 'app',",
  "      company: this.state.deepClient || sess.company || 'all',",
  "      tab: sess.tab || 'exec', reportProject: sess.company",
  '    }, () => {',
  "      this.api('session-status').then(() => {",
  "        this.setState({ sessionWarning:'' });",
  '        this.loadData().then(() => {',
  "          if (this.state.tab === 'historico') this.loadAudit();",
  "          if (this.state.tab === 'acompanhamento') this.loadReport();",
  '        });',
  '      }).catch((err) => {',
  "        const sessionMsg=String((err&&err.message)||err||'');",
  "        const authInvalid=/Não autenticado|HTTP 401|HTTP 403|Credenciais inválidas/i.test(sessionMsg);",
  "        if(authInvalid){ try { localStorage.removeItem('allamo_session'); } catch(e){} this.setState({ screen:'login', token:null, live:false, role:null }); }",
  "        else { console.warn('[session] validação temporariamente indisponível; sessão local preservada',sessionMsg); this.setState({ sessionWarning:'Conexão instável. Mantendo sua sessão e tentando sincronizar os dados.' }); setTimeout(()=>{ try{ this.loadData(); }catch(e){} },1200); }",
  '      });',
  '    });',
  '  }',
  '',
  '  '
].join('\n');
template=template.slice(0,restoreStart)+stableRestore+template.slice(restoreEnd);

// Logout explícito revoga também o token no servidor.
const logoutNeedle="logout() { try{ localStorage.removeItem('allamo_session'); }catch(e){}";
const logoutSafe="logout() { const tok=this.state.token; if(tok){ try{ fetch(this.apiBase()+'/logout',{method:'POST',headers:{authorization:'Bearer '+tok,'content-type':'application/json'},cache:'no-store'}).catch(()=>{}); }catch(e){} } try{ localStorage.removeItem('allamo_session'); }catch(e){}";
if(template.includes(logoutNeedle)) template=template.replace(logoutNeedle,logoutSafe);

if(!template.includes("this.api('session-status').then")) throw new Error('restoreSession ainda não usa endpoint dedicado.');
if(!template.includes('validação temporariamente indisponível')) throw new Error('Sessão ainda pode ser apagada por falha temporária.');
if(!template.includes("this.apiBase()+'/logout'")) throw new Error('Logout servidor não aplicado.');

// JSON.stringify é a única saída autorizada para recolocar o template no bundle.
const serialized=JSON.stringify(template);
JSON.parse(serialized); // sanity check local antes de gravar
html=html.slice(0,jsonStart)+serialized+html.slice(jsonEnd);
fs.writeFileSync(indexFile,html);

console.log('OK: sessão de 7 dias aplicada com template JSON reserializado de forma segura.');
