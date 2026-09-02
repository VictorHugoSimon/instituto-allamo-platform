const RULES = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL_REDACTED]'],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF_REDACTED]'],
  [/\b\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}\b/g, '[CNPJ_REDACTED]'],
  [/\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}\b/g, '[PHONE_REDACTED]'],
  [/\b(?:\d[ -]*?){13,19}\b/g, '[CARD_REDACTED]'],
  [/(bearer\s+)[a-z0-9._~+\/-]+=*/gi, '$1[TOKEN_REDACTED]'],
  [/((?:api[_-]?key|token|secret|password|senha)\s*[:=]\s*)[^\s,;]+/gi, '$1[SECRET_REDACTED]']
];

export function redactServiceText(value, max = 12000) {
  let text = String(value ?? '').slice(0, max);
  let redacted = false;
  for (const [pattern, replacement] of RULES) {
    const next = text.replace(pattern, replacement);
    if (next !== text) redacted = true;
    text = next;
  }
  return { text, redacted };
}
