Next.js 16.3.3
Motivo: npm audit controlado da issue #149 identificou 5 vulnerabilidades altas concentradas na cadeia do Next.js.
Regra: sem npm audit fix --force; commit somente se high=0 e critical=0 após o upgrade e build do workspace web aprovado.
