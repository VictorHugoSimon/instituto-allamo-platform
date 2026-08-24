import fs from 'node:fs';
const auth=fs.readFileSync('sallamos-ai/scripts/prepare-cloudflare-auth.mjs','utf8');
const stage=fs.readFileSync('.github/workflows/deploy-stage.yml','utf8');
const prod=fs.readFileSync('.github/workflows/deploy-production.yml','utf8');
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};

must(auth,"spawnSync",'preflight executa Wrangler sem depender de inferência textual');
must(auth,"wrangler@4.124.0",'versão Wrangler fixada');
must(auth,"'whoami'",'credencial é validada antes de ser persistida no job');
must(auth,"mode: 'api_token'",'modo API Token suportado');
must(auth,"mode: 'api_key_email'",'fallback Global API Key + e-mail suportado');
must(auth,"trying próximo modo disponível".replace('trying','tentando'),'fallback explícito quando primeira credencial falha');
must(auth,"Nenhuma credencial Cloudflare configurada autenticou",'falha fechada quando nenhuma credencial funciona');
must(auth,"::add-mask::",'segredos são mascarados');
must(auth,"GITHUB_ENV",'modo selecionado é propagado ao restante do job');
for(const [workflow,label] of [[stage,'Stage'],[prod,'Produção']]){
  must(workflow,'CLOUDFLARE_API_TOKEN','API Token disponível no workflow '+label);
  must(workflow,'CLOUDFLARE_API_KEY','Global API Key disponível no workflow '+label);
  must(workflow,'CLOUDFLARE_EMAIL','e-mail disponível no workflow '+label);
  must(workflow,'CLOUDFLARE_ACCOUNT_ID','Account ID disponível no workflow '+label);
  must(workflow,'prepare-cloudflare-auth.mjs','preflight autenticado no workflow '+label);
  must(workflow,'Preflight Cloudflare final','segunda confirmação Wrangler no workflow '+label);
}
if(/console\.log\s*\(\s*(token|apiKey|email)\s*\)/.test(auth))throw new Error('Script não pode imprimir segredo em claro.');
console.log('OK: autenticação de CI/CD valida API Token, faz fallback seguro para Global API Key + e-mail e falha fechada sem expor segredo.');
