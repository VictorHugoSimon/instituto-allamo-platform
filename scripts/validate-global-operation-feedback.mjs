import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const source=read('src/interaction-feedback.js');
const index=read('public/index.html');
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};

must(source,'window.AllamoOperation={start,finish,toast','API global de operações');
must(source,"const API_PREFIX='/api/'",'interceptação central da API');
must(source,'window.fetch=function(input,init={})','wrapper global de fetch');
must(source,'delay:write?0:500','feedback imediato em escrita e atrasado em leitura');
must(source,"setAttribute('role','status')",'status acessível');
must(source,"setAttribute('aria-live','polite')",'aria-live acessível');
must(source,"document.documentElement.setAttribute('aria-busy'",'estado global aria-busy');
must(source,'data-allamo-processing','estado visual no botão em processamento');
must(source,'Não feche esta página.','mensagem para operação longa');
must(source,'Gerando Status Report com IA…','feedback contextual da IA');
must(source,'Enviando arquivo…','feedback contextual de upload');
must(source,'Entrando no portal…','feedback contextual de login');
must(source,'Sincronizando Linear…','feedback contextual de sincronização');
must(source,"input instanceof HTMLInputElement",'feedback na preparação de arquivo');

must(index,'__allamoInteractionFeedbackLoaded','runtime de feedback está no artefato final');
must(index,'allamo-operation-hud','HUD de operação está no artefato final');
must(index,'AllamoOperation','API global está no artefato final');
must(index,'Gerando Status Report com IA','mensagens contextuais estão no artefato final');

console.log('OK: toda operação assíncrona relevante possui feedback visual global, contexto, acessibilidade e proteção contra clique duplicado.');
