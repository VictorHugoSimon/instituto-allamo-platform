import fs from 'node:fs';

const worker=fs.readFileSync('public/_worker.js','utf8');
const must=(needle,label)=>{if(!worker.includes(needle))throw new Error(`Ausente: ${label}`)};

must("__portal_no_login:true",'identidade sintética do Portal sem login');
must("user.__portal_no_login === true && request.method === 'DELETE'",'bloqueio de DELETE para identidade sem login');
must("code:'authenticated_session_required'",'código explícito para ação destrutiva bloqueada');
must("error:'Ação destrutiva exige sessão autenticada'",'mensagem operacional segura');

must('// [allamo-onboarding-company-integrity]','hardening de onboarding de empresa');
must("SELECT id FROM companies WHERE lower(trim(name)) = lower(trim(?)) LIMIT 1",'detecção de empresa duplicada por nome');
must("Já existe empresa com esse nome",'conflito explícito de empresa duplicada');
must("await logEvent(env, user, 'empresa:criar'",'auditoria de criação de empresa');

must('// [allamo-onboarding-project-integrity]','hardening de onboarding de projeto');
must("Empresa é obrigatória para criar projeto",'empresa obrigatória no projeto');
must("SELECT id FROM companies WHERE id = ? LIMIT 1",'validação de existência da empresa do projeto');
must("Empresa não encontrada",'erro explícito para empresa inexistente');
must("SELECT id FROM projects WHERE company_id = ? AND lower(trim(name)) = lower(trim(?)) LIMIT 1",'detecção de projeto duplicado por empresa');
must("Já existe projeto com esse nome nesta empresa",'conflito explícito de projeto duplicado');
must("await logEvent(env, user, 'projeto:criar'",'auditoria de criação de projeto');

must("if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);",'RBAC de criação de empresa');
must("if (!['admin','pmo','gestor'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);",'RBAC de criação de projeto');

console.log('OK: mutações destrutivas permanecem protegidas e onboarding empresa→projeto exige integridade, auditoria e prevenção de duplicidade.');
