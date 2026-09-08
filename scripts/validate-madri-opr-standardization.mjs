import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>fs.readFileSync(path.resolve(root,p),'utf8');
const exists=p=>fs.existsSync(path.resolve(root,p));
const fail=m=>{console.error('[MADRI × OPR STANDARD] '+m);process.exitCode=1};
const ok=m=>console.log('[OK] '+m);
const must=(cond,m)=>cond?ok(m):fail(m);

const routes=[
  ['01','/madri/','public/madri/index.html'],
  ['02','/madri-blueprint/','public/madri-blueprint/index.html'],
  ['03','/madri-plano-de-acao/','public/madri-plano-de-acao/index.html'],
  ['04','/madri-requisitos/','public/madri-requisitos/index.html'],
  ['05','/madri-integracoes/','public/madri-integracoes/index.html'],
  ['06','/madri-riscos/','public/madri-riscos/index.html'],
  ['07','/madri-mapa-implantacao/','public/madri-mapa-implantacao/index.html'],
  ['08','/madri-plano-testes/','public/madri-plano-testes/index.html'],
  ['09','/madri-defeitos/','public/madri-defeitos/index.html'],
  ['10','/madri-readiness/','public/madri-readiness/index.html'],
  ['11','/madri-decisoes/','public/madri-decisoes/index.html'],
  ['12','/madri-status-report/','public/madri-status-report/index.html'],
  ['13','/madri-pop/','public/madri-pop/index.html'],
  ['14','/madri-documentos/','public/madri-documentos/index.html'],
  ['15','/madri-biblioteca/','public/madri-biblioteca/index.html']
];

for(const [n,url,file] of routes)must(exists(file),`${n} ${url} possui arquivo permanente`);

const platform=read('public/madri/assets/platform.js');
for(const [n,url] of routes){must(platform.includes(url),`menu MADRI contém ${n} ${url}`)}
for(const label of ['Início','Entender e planejar','Executar e controlar','Validar e decidir','Governança e conhecimento'])must(platform.includes(label),`grupo de navegação presente: ${label}`);
must(platform.includes('Portal único de Governança'),'branding MADRI usa Portal único');
must(!platform.includes('/api/opr-')&&!platform.includes('/api/opr/'),'runtime MADRI não chama API OPR');

const css=read('public/madri/assets/platform.css');
for(const token of ['--char:#302f39','--copper:#b88b78','grid-template-columns:272px 1fr','scroll-behavior:smooth'])must(css.includes(token),`Design System corporativo contém ${token}`);

const portal=read('public/madri/index.html');
must(portal.includes('Portal Único de Governança'),'Portal MADRI segue composição executiva OPR');
must(portal.includes('Dados MADRI ≠ dados OPR'),'Portal explicita isolamento de conteúdo');
must(!portal.includes('/api/opr-')&&!portal.includes('opr_requirements'),'Portal MADRI não depende de dados OPR');

const blueprint=read('public/madri-blueprint/index.html');
must(blueprint.includes('Business Blueprint MADRI × NUCCI'),'Blueprint MADRI é conteúdo próprio');
must(blueprint.includes('19sL6D6CdJC53wUMenHZGw2aJi8N1argH'),'Blueprint aponta para documento MADRI localizado');

const controlled=[
 'public/madri-requisitos/index.html','public/madri-integracoes/index.html','public/madri-riscos/index.html',
 'public/madri-defeitos/index.html','public/madri-readiness/index.html','public/madri-decisoes/index.html','public/madri-documentos/index.html'
];
for(const file of controlled){const s=read(file);must(!/localStorage|sessionStorage/.test(s),`${file} não usa storage local como fonte`);must(!/\/api\/opr-|opr_requirements|opr_risks|opr_integrations/i.test(s),`${file} não referencia backend OPR`)}

const library=read('public/madri-biblioteca/index.html');
must(library.includes('NUCCI')||library.includes('MADRI'),'Biblioteca contém contexto MADRI');
must(library.includes('1wFwqNfuak-jv6ZYVzxL6JBnJwbz4Ldlc'),'Biblioteca aponta para pasta MADRI localizada');
must(library.includes('A confirmar'),'Biblioteca não declara pasta canônica sem validação');

if(process.exitCode)process.exit(process.exitCode);
console.log('MADRI × padrão OPR: contrato visual/navegacional da Fase 1 validado.');
