const base=(process.env.ALLAMO_PRODUCTION_URL||'https://allamo-pmo.pages.dev').replace(/\/$/,'');
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
const missingCompanyError=String(missingCompany.payload?.error||'');
const missingCompanyContract=missingCompanyError.includes('Empresa é obrigatória')||missingCompanyError.includes('Selecione a empresa do projeto');
if(missingCompany.status!==400 || !missingCompanyContract){
  throw new Error(`Projeto sem empresa deveria retornar 400 com contrato de empresa obrigatória; status=${missingCompany.status}, payload=${JSON.stringify(missingCompany.payload)}`);
}
console.log(`OK: projeto sem empresa foi rejeitado com 400 antes de qualquer INSERT (${missingCompanyError}).`);

const nonexistentCompany='__pmo_onboarding_company_missing_'+Date.now()+'__';
const invalidCompany=await postProject({name:'__SMOKE_NEGATIVE_EMPRESA_INEXISTENTE__',company_id:nonexistentCompany});
const invalidCompanyError=String(invalidCompany.payload?.error||'');
if(invalidCompany.status!==404 || !invalidCompanyError.toLowerCase().includes('empresa')){
  throw new Error(`Projeto com empresa inexistente deveria retornar 404/empresa inválida; status=${invalidCompany.status}, payload=${JSON.stringify(invalidCompany.payload)}`);
}
console.log(`OK: projeto com empresa inexistente foi rejeitado com 404 antes de qualquer INSERT (${invalidCompanyError}).`);
console.log('OK: smoke negativo de onboarding em PRODUÇÃO concluído sem criar empresa/projeto.');
