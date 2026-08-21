import fs from 'node:fs';

const file = 'public/index.html';
let html = fs.readFileSync(file, 'utf8');

// 1) Nunca exibir o painel técnico do bundler para o usuário final.
// Mantemos o erro no console para diagnóstico, mas o overlay visual fica oculto.
const errorStyle = "d.style.cssText = 'position:fixed;bottom:12px;left:12px;right:12px;font:12px/1.4 ui-monospace,monospace;background:#2a1215;color:#ff8a80;padding:10px 14px;border-radius:8px;border:1px solid #5c2b2e;z-index:99999;white-space:pre-wrap;max-height:40vh;overflow:auto';";
if (html.includes(errorStyle)) {
  html = html.replace(errorStyle, "d.style.cssText = 'display:none!important'; console.error('[bundle]', e.message || e.type, e.error || '');");
}

// 2) Boot guard: a interface empacotada pode conter uma fotografia antiga do estado.
// Ela só deve ficar visível depois que os primeiros requests /api estabilizarem.
const resourceNeedle = "const resourceScript = '<script>window.__resources = ' +";
const resourceReplacement = `const resourceScript = '<style id="allamo-boot-guard">body{visibility:hidden!important}</style><script>' +\n      '(function(){' +\n      'window.__allamoApiPending=0;' +\n      'window.__allamoBootStarted=Date.now();' +\n      'var of=window.fetch.bind(window);' +\n      'window.fetch=function(){var a=arguments,u=String((a[0]&&a[0].url)||a[0]||""),api=u.indexOf("/api/")>=0;if(api)window.__allamoApiPending++;return of.apply(window,a).finally(function(){if(api)window.__allamoApiPending=Math.max(0,window.__allamoApiPending-1);});};' +\n      'window.__allamoRevealWhenReady=function(){var quietSince=0,max=Date.now()+6000;function tick(){var now=Date.now(),p=window.__allamoApiPending||0;if(p===0){if(!quietSince)quietSince=now;}else quietSince=0;if((quietSince&&now-quietSince>=700)||now>=max){var s=document.getElementById("allamo-boot-guard");if(s)s.remove();if(document.body)document.body.style.visibility="visible";document.documentElement.classList.add("allamo-ready");return;}setTimeout(tick,75);}tick();};' +\n      '})();' +\n      '</' + 'script><script>window.__resources = ' +`;
if (html.includes(resourceNeedle) && !html.includes('window.__allamoApiPending')) {
  html = html.replace(resourceNeedle, resourceReplacement);
}

// 3) Dispara a revelação somente depois que os scripts do bundle foram recriados.
const babelNeedle = `if (window.Babel && typeof window.Babel.transformScriptTags === 'function') {\n      window.Babel.transformScriptTags();\n    }`;
const babelReplacement = `${babelNeedle}\n    if (typeof window.__allamoRevealWhenReady === 'function') window.__allamoRevealWhenReady();`;
if (html.includes(babelNeedle) && !html.includes("typeof window.__allamoRevealWhenReady")) {
  html = html.replace(babelNeedle, babelReplacement);
}

if (!html.includes('allamo-boot-guard') || !html.includes('display:none!important')) {
  throw new Error('Hardening incompleto: marcadores esperados não foram aplicados.');
}

fs.writeFileSync(file, html);
console.log('OK: runtime protegido contra flash de estado antigo e overlay técnico.');
