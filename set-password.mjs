// set-password.mjs — gera o hash para atualizar a senha de um usuário
// Uso:  node set-password.mjs usuario@empresa.com.br "novaSenha"
// Depois cole o UPDATE no D1 Console (ou via wrangler d1 execute).
import { webcrypto as c } from 'node:crypto';
const [,, email, senha] = process.argv;
if (!email || !senha) { console.log('Uso: node set-password.mjs email senha'); process.exit(1); }
const buf = await c.subtle.digest('SHA-256', new TextEncoder().encode(senha + ':' + email));
const hash = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
console.log(`UPDATE users SET password_hash='${hash}' WHERE email='${email}';`);
