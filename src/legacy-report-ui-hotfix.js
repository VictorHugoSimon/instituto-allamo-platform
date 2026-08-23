(()=>{
  if(window.__allamoReportUiHotfixLoaded)return;
  window.__allamoReportUiHotfixLoaded=true;

  const STYLE_ID='allamo-report-ui-hotfix-style';
  const css=`
#ard-panel{margin:14px 0;padding:18px;border:1px solid #e5ddd7;border-radius:16px;background:#fffaf7;box-shadow:0 8px 24px rgba(48,47,57,.06);font-family:inherit}
#ard-panel .ard-head,#ard-panel .ard-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#ard-panel .ard-head{margin-bottom:12px}
#ard-panel .ard-head>b{font-size:15px;color:#302f39}
.ard-btn{appearance:none;border:1px solid #d0d5dd;background:#fff;color:#344054;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:750;cursor:pointer;transition:.15s ease;line-height:1.2}
.ard-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(48,47,57,.10);border-color:#b8b4b0}
.ard-btn:disabled{opacity:.55;cursor:not-allowed;transform:none;box-shadow:none}
.ard-primary{background:#302f39!important;color:#fff!important;border-color:#302f39!important}
.ard-ai{background:#8f715e!important;color:#fff!important;border-color:#8f715e!important;padding:10px 14px!important}
.ard-danger{color:#b42318!important}
.ard-sec,.ard-field{border:1px solid #e4e1dc;border-radius:12px;padding:12px;margin-top:9px;background:#fff}
.ard-field{border-style:dashed;background:#fffdfb}
.ard-grid{display:grid;grid-template-columns:minmax(0,1.5fr) 150px 95px;gap:8px}
.ard-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;margin-top:8px}
.ard-sec input,.ard-sec select,.ard-sec textarea,.arai-box input,.arai-box textarea{width:100%;box-sizing:border-box;padding:10px;border:1px solid #d0d5dd;border-radius:9px;font-size:13px;background:#fff;color:#101828}
.ard-sec input:focus,.ard-sec select:focus,.ard-sec textarea:focus,.arai-box input:focus,.arai-box textarea:focus{outline:2px solid rgba(143,113,94,.18);border-color:#8f715e}
.ard-small{font-size:11.5px;color:#667085;line-height:1.45}
.ard-empty{border:1px dashed #d0d5dd;border-radius:10px;padding:14px;text-align:center;color:#667085;font-size:12px;background:#fff}
.ard-guide{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:10px 0 14px}
.ard-guide-step{padding:9px 10px;border:1px solid #e4e1dc;border-radius:10px;background:#fff;font-size:11px;color:#667085;line-height:1.35}
.ard-guide-step b{display:block;color:#302f39;font-size:11.5px;margin-bottom:2px}
.ard-tip{margin:8px 0 12px;padding:10px 12px;border-radius:10px;background:#f4eee9;color:#5d4b40;font-size:12px;line-height:1.45}
#ard-panel details{position:relative}
#ard-panel details>summary{display:inline-flex;align-items:center;user-select:none}
#ard-panel details>div{min-width:260px;right:0;margin-top:5px}
.arai{position:fixed;inset:0;z-index:100000;background:rgba(16,24,40,.62);display:flex;align-items:center;justify-content:center;padding:18px}
.arai-box{width:min(1040px,96vw);max-height:94vh;overflow:auto;background:#fff;border-radius:18px;padding:22px;box-shadow:0 30px 80px rgba(0,0,0,.28);font-family:inherit}
.arai-box h2{font-size:21px;color:#302f39}
.arai-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.arai-card{border:1px solid #e4e1dc;border-radius:11px;padding:11px;margin:8px 0;background:#fff}
.arai-warn{background:#fff7e8}.arai-crit{background:#fff1f0}.arai-ok{background:#ecfdf3}
.arai-row{display:flex;gap:9px;align-items:flex-start}.arai-row input[type=checkbox]{width:auto;margin-top:4px}
.arai-tag{display:inline-block;margin:4px 4px 0 0;padding:3px 7px;border-radius:999px;background:#eef1f4;font-size:10px;font-weight:800}
.arai-toolbar{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px}
.arai-error{margin-top:10px;padding:10px;border-radius:10px;background:#fff1f0;color:#b42318;font-size:12px}
.arai-pre{white-space:pre-wrap;background:#f8fafc;padding:10px;border-radius:9px;max-height:400px;overflow:auto;font-size:11px}
.arai-guide{margin:12px 0 16px;padding:12px;border-radius:12px;background:#f8f5f2;border:1px solid #eadfd8}
.arai-guide-title{font-weight:800;color:#302f39;font-size:13px;margin-bottom:7px}
.arai-guide-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
.arai-guide-steps span{background:#fff;border:1px solid #e4e1dc;border-radius:9px;padding:8px;font-size:11px;color:#667085;line-height:1.35}
.arai-guide-steps b{color:#8f715e}
#allamo-custom-client{max-width:1180px;margin:18px auto;padding:16px;background:#fff;border:1px solid #e4e1dc;border-radius:14px}.acc-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.acc-field{background:#faf9f7;border-radius:9px;padding:10px}.acc-label{font-size:11px;font-weight:800;color:#667085;text-transform:uppercase}.acc-value{white-space:pre-wrap;font-size:13px;margin-top:3px}
@media(max-width:760px){.ard-grid,.ard-grid2,.arai-two,.acc-fields,.ard-guide,.arai-guide-steps{grid-template-columns:1fr}}
`;

  function ensureStyle(){
    let s=document.getElementById(STYLE_ID);
    if(!s){s=document.createElement('style');s.id=STYLE_ID;(document.head||document.documentElement).appendChild(s)}
    if(s.textContent!==css)s.textContent=css;
  }

  function enhancePanel(){
    const p=document.getElementById('ard-panel');
    if(!p)return;
    const title=p.querySelector('.ard-head>b');
    if(title)title.textContent='Assistente de Status Report';
    const hist=p.querySelector('[data-act="history"]');if(hist)hist.textContent='🕘 Histórico';
    const ai=p.querySelector('[data-act="ai"]');if(ai){ai.textContent='✨ Atualizar Report com IA';ai.title='Cole a reunião e deixe a IA preparar um rascunho para sua validação'}
    const add=p.querySelector('[data-act="add-sec"]');if(add){add.textContent='＋ Adicionar informação';add.title='Crie um novo bloco de informações para este Report'}
    const sum=p.querySelector('details>summary');if(sum)sum.textContent='⚙️ Personalizar campos';
    if(!p.querySelector('.ard-guide')){
      const g=document.createElement('div');g.className='ard-guide';g.innerHTML='<div class="ard-guide-step"><b>1 · Reunião</b>Cole o resumo ou a transcrição.</div><div class="ard-guide-step"><b>2 · IA sugere</b>Riscos, ações, decisões e mudanças.</div><div class="ard-guide-step"><b>3 · Você revisa</b>Aceite somente o que estiver correto.</div><div class="ard-guide-step"><b>4 · Nova versão</b>Salve sem perder o histórico.</div>';
      const head=p.querySelector('.ard-head');if(head)head.insertAdjacentElement('afterend',g);else p.prepend(g);
    }
    if(!p.querySelector('.ard-tip')){
      const t=document.createElement('div');t.className='ard-tip';t.textContent='Dica: para atualizar o Report depois de uma reunião, use “Atualizar Report com IA”. Para criar campos específicos deste cliente, use “Adicionar informação”.';
      const guide=p.querySelector('.ard-guide');if(guide)guide.insertAdjacentElement('afterend',t);
    }
    const empty=p.querySelector('.ard-empty');
    if(empty&&/ainda não possui campos adicionais/i.test(empty.textContent||''))empty.textContent='Nenhuma informação personalizada ainda. Use “Adicionar informação” somente quando este projeto precisar de um campo que não existe no modelo padrão.';
  }

  function enhanceAiModal(){
    const boxes=[...document.querySelectorAll('.arai-box')];
    const box=boxes.find(x=>/Gerar Status Report com IA|Atualizar Status Report com IA/i.test(x.querySelector('h2')?.textContent||''));
    if(!box)return;
    const h=box.querySelector('h2');if(h)h.textContent='Atualizar Status Report com IA';
    const sub=box.querySelector('.ard-head .ard-small');if(sub)sub.textContent='Cole o que aconteceu na reunião. A IA monta um rascunho; nada é salvo sem sua aprovação.';
    if(!box.querySelector('.arai-guide')){
      const g=document.createElement('div');g.className='arai-guide';g.innerHTML='<div class="arai-guide-title">Como usar</div><div class="arai-guide-steps"><span><b>1.</b> Cole a reunião</span><span><b>2.</b> Anexe evidências se tiver</span><span><b>3.</b> Gere o rascunho</span><span><b>4.</b> Revise e salve</span></div>';
      const head=box.querySelector('.ard-head');if(head)head.insertAdjacentElement('afterend',g);else box.prepend(g);
    }
    const meeting=box.querySelector('#meeting');if(meeting)meeting.placeholder='Ex.: Ambiente liberado. Cadastro de produtos está atrasado. João ficou responsável pelas fichas técnicas. Go-live não foi alterado...';
    const inst=box.querySelector('#inst');if(inst)inst.placeholder='Opcional. Ex.: dê atenção aos riscos que podem afetar o Go-live.';
    const gen=box.querySelector('#gen');if(gen&&!gen.disabled)gen.textContent='✨ Gerar rascunho do Report';
  }

  // O portal é reconstruído após o unpack e o runtime principal captura cliques.
  // Interceptamos em capture para garantir que os controles adicionados ao Report recebam ação.
  function capture(e){
    const summary=e.target?.closest?.('#ard-panel details>summary');
    if(summary){e.preventDefault();e.stopImmediatePropagation();summary.parentElement.open=!summary.parentElement.open;return}
    const b=e.target?.closest?.('#ard-panel [data-act]');
    if(!b)return;
    const p=b.closest('#ard-panel');
    if(!p||typeof p.onclick!=='function')return;
    e.preventDefault();e.stopImmediatePropagation();
    try{p.onclick({target:b,preventDefault(){},stopPropagation(){}})}catch(err){console.error('[report-ui-hotfix]',err)}
  }
  document.addEventListener('click',capture,true);

  function tick(){ensureStyle();enhancePanel();enhanceAiModal()}
  tick();setInterval(tick,350);
  window.addEventListener('allamo:data-changed',tick);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});
})();
