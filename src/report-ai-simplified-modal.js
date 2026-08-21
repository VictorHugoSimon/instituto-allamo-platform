(()=>{
  if(window.__allamoReportAiSimplifiedModalLoaded)return;
  window.__allamoReportAiSimplifiedModalLoaded=true;

  const STYLE_ID='allamo-report-ai-simplified-style';
  const css=`
.arai-box .allamo-ai-primary{margin-top:12px;padding:14px 16px;border:1px solid #e4e1dc;border-radius:14px;background:#fffaf7}
.arai-box .allamo-ai-primary h3{margin:0 0 4px;font-size:15px;color:#302f39}
.arai-box .allamo-ai-primary p{margin:0 0 10px;font-size:12px;color:#667085;line-height:1.45}
.arai-box .allamo-ai-advanced{margin-top:12px;border:1px solid #e4e1dc;border-radius:12px;background:#fff}
.arai-box .allamo-ai-advanced>summary{cursor:pointer;list-style:none;padding:11px 13px;font-size:12px;font-weight:800;color:#5d4b40;display:flex;align-items:center;gap:7px}
.arai-box .allamo-ai-advanced>summary::-webkit-details-marker{display:none}
.arai-box .allamo-ai-advanced>summary:before{content:'＋';font-weight:900;color:#8f715e}
.arai-box .allamo-ai-advanced[open]>summary:before{content:'−'}
.arai-box .allamo-ai-advanced-body{padding:0 13px 13px}
.arai-box .allamo-ai-status{margin:10px 0 0;padding:9px 11px;border-radius:10px;background:#f8f5f2;color:#5d4b40;font-size:11.5px;line-height:1.45}
.arai-box .allamo-ai-status strong{color:#302f39}
.arai-box .allamo-ai-submit{width:100%;justify-content:center;padding:12px 16px!important;font-size:13px!important}
.arai-box .allamo-ai-helper{font-size:11px;color:#667085;margin-top:6px;line-height:1.4}
`;

  function ensureStyle(){
    let s=document.getElementById(STYLE_ID);
    if(!s){s=document.createElement('style');s.id=STYLE_ID;(document.head||document.documentElement).appendChild(s)}
    if(s.textContent!==css)s.textContent=css;
  }
  function labelFor(control){return control?.closest('label')||null}

  function simplify(){
    const boxes=[...document.querySelectorAll('.arai-box')];
    const box=boxes.find(x=>/Atualizar Status Report com IA|Gerar Status Report com IA/i.test(x.querySelector('h2')?.textContent||''));
    if(!box||box.dataset.simplified==='1')return;
    const meeting=box.querySelector('#meeting'),sname=box.querySelector('#sname'),sdate=box.querySelector('#sdate'),stext=box.querySelector('#stext'),files=box.querySelector('#files'),inst=box.querySelector('#inst'),gen=box.querySelector('#gen');
    if(!meeting||!gen)return;

    const meetingLabel=labelFor(meeting);
    if(meetingLabel){
      const textNode=[...meetingLabel.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());
      if(textNode)textNode.textContent='Cole o resumo ou a transcrição da reunião';
      const wrap=document.createElement('div');wrap.className='allamo-ai-primary';meetingLabel.parentNode.insertBefore(wrap,meetingLabel);wrap.appendChild(meetingLabel);
      const intro=document.createElement('div');intro.innerHTML='<h3>O que aconteceu na reunião?</h3><p>Cole o resumo, ata ou transcrição. Só isso já é suficiente para a IA preparar o rascunho do Report.</p>';wrap.insertBefore(intro,meetingLabel);
    }

    const advanced=document.createElement('details');advanced.className='allamo-ai-advanced';advanced.innerHTML='<summary>Adicionar evidências ou orientações</summary><div class="allamo-ai-advanced-body"></div>';
    const body=advanced.querySelector('.allamo-ai-advanced-body');
    const firstAdvanced=labelFor(sname)||labelFor(stext)||labelFor(files)||labelFor(inst);
    if(firstAdvanced)firstAdvanced.parentNode.insertBefore(advanced,firstAdvanced);
    for(const el of [sname,sdate,stext,files,inst]){const l=labelFor(el);if(l&&l.parentNode!==body)body.appendChild(l)}
    const helper=document.createElement('div');helper.className='allamo-ai-helper';helper.textContent='Use esta área somente quando quiser anexar um cronograma, registrar a fonte ou orientar a análise.';body.prepend(helper);

    for(const err of [...box.querySelectorAll('.arai-error')]){
      if(/modo gratuito|cloudflare|pdf\/imagem/i.test(err.textContent||'')){
        err.className='allamo-ai-status';err.innerHTML='<strong>Modo gratuito ativo.</strong> Para o uso diário, cole a reunião acima. Arquivos podem ser adicionados como apoio quando houver texto disponível.';
      }
    }
    gen.textContent='✨ Gerar rascunho do Report';gen.classList.add('allamo-ai-submit');const toolbar=gen.closest('.arai-toolbar');if(toolbar)toolbar.style.display='block';
    meeting.placeholder='Cole aqui o resumo, ata ou transcrição da reunião. Ex.: Cadastros em andamento; TOTVS aguarda validação da Dual; Go-live sem alteração...';meeting.focus();box.dataset.simplified='1';
  }
  function tick(){ensureStyle();simplify()}
  tick();setInterval(tick,300);window.addEventListener('allamo:data-changed',tick);
})();
