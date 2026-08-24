import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const index = read('public/index.html');
const worker = read('public/_worker.js');
const sw = read('public/sw.js');

const must = (content, needle, label) => {
  if (!content.includes(needle)) {
    throw new Error(`Paridade visual ausente: ${label} (${needle})`);
  }
};

// Contrato visual homologado no Stage para a visão interna de Portfólio > Empresas.
must(index, 'Empresas na carteira', 'KPI Empresas na carteira');
must(index, 'Sistema próprio', 'KPI Sistema próprio');
must(index, 'Com dono definido', 'KPI Com dono definido');
must(index, 'Sem responsável', 'KPI Sem responsável');
must(index, '+ Projeto nesta empresa', 'ação de criar projeto dentro da empresa');
must(index, 'Acompanhar', 'ação Acompanhar na empresa');
must(index, 'Abrir →', 'ação Abrir na empresa');
must(index, 'Editar', 'ação Editar na empresa');
must(index, 'Excluir', 'ação Excluir na empresa');
must(index, '↓ Instalar app', 'botão Instalar app no cabeçalho');
must(index, 'Visão Executiva', 'navegação Visão Executiva');
must(index, 'Empresas', 'navegação Empresas');
must(index, 'Projetos', 'navegação Projetos');
must(index, 'Trabalho', 'navegação Trabalho');
must(index, 'Reports', 'navegação Reports');
must(index, 'Comunicação', 'grupo Comunicação');
must(index, 'Gestão & Ajuda', 'grupo Gestão & Ajuda');

// Produção não pode manter HTML antigo por cache ou Service Worker legado.
must(worker, "request.mode === 'navigate'", 'HTML de navegação sem cache persistente');
must(worker, "headers.set('cache-control','no-store, no-cache, must-revalidate, max-age=0')", 'Cache-Control no-store do HTML');
must(worker, "url.pathname === '/sw.js'", 'Service Worker com revalidação');
must(sw, "const CACHE='allamo-pmo-static-v3'", 'versão atual do cache do Service Worker');
must(sw, "cache:'no-store'", 'navegação e dados network-only');
must(sw, "cache:'no-cache'", 'assets network-first com revalidação');

console.log('OK: artefato final mantém paridade visual Stage→Produção e política anti-cache legado.');
