(()=>{
  if(window.__allamoLoginInteractionGuard)return;
  window.__allamoLoginInteractionGuard=true;

  const draft={email:'',password:''};
  let loginBusy=false;

  const loginForm=()=>{
    const forms=Array.from(document.querySelectorAll('form'));
    return forms.find(form=>{
      const email=form.querySelector('input[type="email"]');
      const password=form.querySelector('input[type="password"]');
      if(!email||!password)return false;
      const text=(form.textContent||'').toLowerCase();
      return text.includes('entrar')||text.includes('e-mail')||text.includes('email');
    })||null;
  };

  const showError=(form,message)=>{
    if(!form)return;
    let box=form.querySelector('[data-allamo-native-login-error]');
    if(!box){
      box=document.createElement('div');
      box.setAttribute('data-allamo-native-login-error','1');
      box.style.cssText='font-size:12.5px;color:#b42318;font-weight:700;line-height:1.4;margin-top:2px';
      const button=form.querySelector('button[type="submit"],button');
      if(button)form.insertBefore(box,button);else form.appendChild(box);
    }
    box.textContent=message||'';
    box.style.display=message?'block':'none';
  };

  const setBusy=(form,busy)=>{
    const button=form&&form.querySelector('button[type="submit"],button');
    if(!button)return;
    if(!button.dataset.allamoOriginalLabel)button.dataset.allamoOriginalLabel=button.textContent||'Entrar';
    button.disabled=!!busy;
    button.textContent=busy?'Entrando…':button.dataset.allamoOriginalLabel;
  };

  const saveSessionAndReload=(res)=>{
    const user=res&&res.user||{};
    const role=user.role||'usuario';
    const defaultTab={admin:'exec',pmo:'exec',techlead:'gmud',gestor:'exec',usuario:'visao'}[role]||'exec';
    const company=user.company_id||'all';
    const session={token:res.token,role,company,tab:defaultTab,name:user.name||''};
    localStorage.setItem('allamo_session',JSON.stringify(session));
    location.reload();
  };

  const nativeLogin=async(form)=>{
    if(loginBusy)return;
    const email=form.querySelector('input[type="email"]');
    const password=form.querySelector('input[type="password"]');
    const emailValue=String((email&&email.value)||draft.email||'').trim();
    const passwordValue=String((password&&password.value)||draft.password||'');
    if(!emailValue||!passwordValue){showError(form,'Informe e-mail e senha.');return;}
    draft.email=emailValue;draft.password=passwordValue;
    loginBusy=true;setBusy(form,true);showError(form,'');
    try{
      const response=await fetch('/api/login',{
        method:'POST',
        headers:{'content-type':'application/json','cache-control':'no-cache, no-store, max-age=0','pragma':'no-cache'},
        cache:'no-store',credentials:'same-origin',
        body:JSON.stringify({email:emailValue,password:passwordValue})
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||('HTTP '+response.status));
      if(!payload.token)throw new Error('Login não retornou uma sessão válida.');
      draft.password='';
      saveSessionAndReload(payload);
    }catch(err){
      loginBusy=false;setBusy(form,false);
      showError(form,String((err&&err.message)||err||'Não foi possível entrar.'));
    }
  };

  const bind=()=>{
    const form=loginForm();
    if(!form)return;
    const email=form.querySelector('input[type="email"]');
    const password=form.querySelector('input[type="password"]');
    if(!email||!password)return;

    email.setAttribute('name','email');
    email.setAttribute('autocomplete','username');
    password.setAttribute('name','password');
    password.setAttribute('autocomplete','current-password');

    if(draft.email&&email.value!==draft.email)email.value=draft.email;
    else if(!draft.email&&email.value)draft.email=email.value;
    if(draft.password&&password.value!==draft.password)password.value=draft.password;
    else if(!draft.password&&password.value)draft.password=password.value;

    if(!email.dataset.allamoNativeInput){
      email.dataset.allamoNativeInput='1';
      email.addEventListener('input',()=>{draft.email=email.value;showError(form,'')},true);
      email.addEventListener('change',()=>{draft.email=email.value},true);
      email.addEventListener('keydown',()=>{setTimeout(()=>{draft.email=email.value},0)},true);
    }
    if(!password.dataset.allamoNativeInput){
      password.dataset.allamoNativeInput='1';
      password.addEventListener('input',()=>{draft.password=password.value;showError(form,'')},true);
      password.addEventListener('change',()=>{draft.password=password.value},true);
      password.addEventListener('keydown',()=>{setTimeout(()=>{draft.password=password.value},0)},true);
    }
    if(!form.dataset.allamoNativeLogin){
      form.dataset.allamoNativeLogin='1';
      form.addEventListener('submit',e=>{
        e.preventDefault();
        e.stopImmediatePropagation();
        nativeLogin(form);
      },true);
    }
  };

  bind();
  const observer=new MutationObserver(()=>bind());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setInterval(bind,1000);
})();
