(function(){
  if(window.__allamoPmoHeaderPrivacyLoaded)return;
  window.__allamoPmoHeaderPrivacyLoaded=true;

  function text(el){return String((el&&el.textContent)||'').replace(/\s+/g,' ').trim();}
  function interactive(el){
    if(!el)return false;
    var tag=String(el.tagName||'').toUpperCase();
    return /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(tag)||!!el.querySelector('button,a,input,select,textarea');
  }
  function roleLike(value){
    return /Consultor\s*PMO|PMO|Administrador|Admin|Tech\s*Lead|Gestor|Usu[aá]rio/i.test(String(value||''));
  }
  function headerSized(el){
    try{
      var r=el.getBoundingClientRect();
      return r.top>=0&&r.top<170&&r.width>0&&r.width<360&&r.height>0&&r.height<110;
    }catch(_){return false;}
  }
  function hideTextBlock(el){
    if(!el||interactive(el)||!headerSized(el))return false;
    var value=text(el);
    if(!value||value.length>160||!roleLike(value))return false;
    el.style.setProperty('display','none','important');
    el.setAttribute('data-allamo-hidden-user-name','1');
    el.setAttribute('aria-hidden','true');
    el.removeAttribute('title');
    el.querySelectorAll('[title],[aria-label]').forEach(function(child){
      child.removeAttribute('title');
      child.removeAttribute('aria-label');
    });
    return true;
  }
  function clean(){
    document.querySelectorAll('button,a').forEach(function(exit){
      if(text(exit)!=='Sair')return;
      var hidden=false;
      var prev=exit.previousElementSibling;
      var scanned=0;
      while(prev&&scanned<5){
        var candidate=prev;
        prev=prev.previousElementSibling;
        scanned++;
        if(hideTextBlock(candidate)){hidden=true;break;}
      }
      if(hidden)return;
      var parent=exit.parentElement;
      if(!parent)return;
      Array.from(parent.children).forEach(function(candidate){
        if(candidate===exit||hidden)return;
        if(hideTextBlock(candidate))hidden=true;
      });
    });
  }

  clean();
  new MutationObserver(function(){clean();}).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  setInterval(clean,1000);
})();
