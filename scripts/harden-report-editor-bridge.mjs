import fs from 'node:fs';

const file='public/index.html';
let html=fs.readFileSync(file,'utf8');

// A instância do componente legado é quem possui openReportEditor().
// Expõe uma ponte estável para os scripts pós-unpack, sem depender do binding sc-camel-on-click.
const bridgeMarker='window.__allamoOpenLegacyReportEditor';
if(!html.includes(bridgeMarker)){
  const needle="  renderVals() {\\\n    const st = this.state, role = st.role, accent = this.ACCENT();\\";
  const replacement="  renderVals() {\\\n    try { window.__allamoLegacyReportInstance=this; window.__allamoOpenLegacyReportEditor=(anchor='')=>this.openReportEditor(anchor); } catch(e){}\\\n    const st = this.state, role = st.role, accent = this.ACCENT();\\";
  if(!html.includes(needle))throw new Error('renderVals não encontrado para instalar ponte do editor.');
  html=html.replace(needle,replacement);
}

// Report de projeto usa repKey() (ex.: p:123), e não apenas company_id.
const oldDraft="    const cur = (this.reports && this.reports[cid]) ? JSON.parse(JSON.stringify(this.reports[cid])) : base;\\";
if(html.includes(oldDraft)){
  const newDraft="    const reportKey = this.repKey();\\\n    const cur = (this.reports && this.reports[reportKey]) ? JSON.parse(JSON.stringify(this.reports[reportKey])) : base;\\";
  html=html.replace(oldDraft,newDraft);
}

if(!html.includes(bridgeMarker))throw new Error('Ponte global do editor não aplicada.');
if(!html.includes('const reportKey = this.repKey();'))throw new Error('Editor ainda não usa a chave do projeto/empresa ativa.');
if(html.includes(oldDraft))throw new Error('Leitura antiga por company_id ainda presente no openReportEditor.');

fs.writeFileSync(file,html);
console.log('OK: lápis/botão usam ponte pós-unpack e o editor carrega o Report do projeto ativo.');
