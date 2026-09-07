(function(){
  if(window.__allamoPmoHeaderPrivacyLoaded)return;
  window.__allamoPmoHeaderPrivacyLoaded=true;

  function text(el){return String((el&&el.textContent)||'').replace(/\s+/g,' ').trim();}
  function interactive(el){
    if(!el)return false;
    var tag=String(el.tagName||'').toUpperCase();
    return /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(tag)||!!el.querySelector('button,a,input,select,textarea');
  }
  function headerSized(el){
    try{
      var r=el.getBoundingClientRect();
      return r.top>=0&&r.top<170&&r.width>0&&r.width<360&&r.height>0&&r.height<110;
    }catch(_){return false;}
  }
  function removeIdentity(el){
    if(!el||interactive(el)||!headerSized(el))return false;
    el.removeAttribute('title');
    el.removeAttribute('aria-label');
    el.querySelectorAll('[title],[aria-label]').forEach(function(child){
      child.removeAttribute('title');
      child.removeAttribute('aria-label');
    });
    el.remove();
    return true;
  }
  function clean(){
    document.querySelectorAll('button,a').forEach(function(exit){
      if(text(exit)!=='Sair')return;
      var parent=exit.parentElement;
      if(!parent||!headerSized(parent))return;
      var prev=exit.previousElementSibling;
      var scanned=0;
      var removed=0;
      while(prev&&scanned<4){
        var candidate=prev;
        prev=prev.previousElementSibling;
        scanned++;
        if(interactive(candidate))break;
        if(removeIdentity(candidate))removed++;
      }
      parent.setAttribute('data-allamo-user-identity-free','1');
      parent.setAttribute('data-allamo-identity-nodes-removed',String(removed));
    });
  }

  clean();
  new MutationObserver(function(){clean();}).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  setInterval(clean,1000);
})();
