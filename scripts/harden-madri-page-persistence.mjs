import fs from 'node:fs';

const pages=[
  {file:'public/madri-pop/index.html',page:'pop',marker:"const KEY='madri-pop-v1-local'"},
  {file:'public/madri-mapa-implantacao/index.html',page:'map',marker:"const KEY='madri-mapa-implantacao-v1'"}
];

for(const cfg of pages){
  if(!fs.existsSync(cfg.file))throw new Error(`Página MADRI ausente: ${cfg.file}`);
  let html=fs.readFileSync(cfg.file,'utf8');
  const tag=`<script src="/madri/assets/page-persistence.js" data-madri-page="${cfg.page}"></script>`;
  if(!html.includes(tag)){
    const pos=html.indexOf(cfg.marker);
    if(pos<0)throw new Error(`Script local legado não encontrado em ${cfg.file}`);
    const start=html.lastIndexOf('<script>',pos),end=html.indexOf('</script>',pos);
    if(start<0||end<0)throw new Error(`Bloco script legado inválido em ${cfg.file}`);
    html=html.slice(0,start)+tag+html.slice(end+'</script>'.length);
  }
  if(cfg.page==='pop'){
    html=html
      .replace('Alterações feitas no modo edição ficam salvas neste navegador.','Alterações do modo edição são persistidas no D1 do projeto MADRI.')
      .replace('O conteúdo alterado é salvo localmente neste navegador e pode ser exportado em JSON. A versão publicada no Git permanece como referência oficial e pode ser restaurada a qualquer momento.','O conteúdo alterado é persistido no D1, com histórico de versões e restauração. A versão publicada no Git permanece como baseline oficial.')
      .replace('Histórico de versões locais','Histórico de versões D1')
      .replace('Snapshots gerados ao salvar alterações neste navegador.','Snapshots imutáveis gerados a cada salvamento no D1.');
  }else{
    html=html.replace('Modo edição ativo · salvamento local neste navegador','Modo edição ativo · persistência no D1 MADRI');
  }
  if(/localStorage\s*\./.test(html))throw new Error(`${cfg.file} ainda usa localStorage após hardening`);
  if(!html.includes('/api/madri-platform/')&&!html.includes('page-persistence.js'))throw new Error(`${cfg.file} não está conectado ao runtime D1 MADRI`);
  fs.writeFileSync(cfg.file,html);
}
console.log('OK: POP e Mapa Mestre MADRI usam persistência D1 global, sem localStorage operacional.');
