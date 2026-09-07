const base=(process.env.ALLAMO_STAGE_URL||'https://allamo-pmo-stage.pages.dev').replace(/\/$/,'');
const token=String(process.env.ALLAMO_PMO_SMOKE_TOKEN||'').trim();
if(!token)throw new Error('ALLAMO_PMO_SMOKE_TOKEN não informado.');

async function postProject(body){
  const response=await fetch(base+'/api/projects',{
    method:'POST',
    headers:{
      authorization:'Bearer '+token,
      'content-type':'application/json',
      'cache-control':'no-store'
    },
    body:JSON.stringify(body),
    redirect:'follow'
  });
  const payload=await response.json().catch(()=>null);
  return {status:response.status,payload};
}

const missingCompany=await postProject({name:'__SMOKE_NEGATIVE_SEM_EMPRESA__'});
if(missingCompany.status!==400 || !String(missingCompany.payload?.error||'').includes('Empresa é obrigatória')){
  throw new Error(`Projeto sem empresa deveria retornar 400/empresa obrigatória; status=${missingCompany.status}, payload=${JSON.stringify(missingCompany.payload)}`);
}
console.log('OK: projeto sem empresa foi rejeitado com 400 antes de qualquer INSERT.');

const nonexistentCompany='__pmo_onboarding_company_missing_'+Date.now()+'__';
const invalidCompany=await postProject({name:'__SMOKE_NEGATIVE_EMPRESA_INEXISTENTE__',company_id:nonexistentCompany});
if(invalidCompany.status!==404 || !String(invalidCompany.payload?.error||'').includes('Empresa não encontrada')){
  throw new Error(`Projeto com empresa inexistente deveria retornar 404; status=${invalidCompany.status}, payload=${JSON.stringify(invalidCompany.payload)}`);
}
console.log('OK: projeto com empresa inexistente foi rejeitado com 404 antes de qualquer INSERT.');
console.log('OK: smoke negativo de onboarding no STAGE concluído sem criar empresa/projeto.');
