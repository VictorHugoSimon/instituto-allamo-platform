Next.js 16.3.3 — tentativa 2
Motivo: o upgrade do Next reduziu 5 vulnerabilidades altas para 2; agora aplicar correção transitiva compatível via `npm audit fix --package-lock-only --ignore-scripts`, sem `--force`.
Gate: commit somente se high=0, critical=0, nenhuma dependência direta inesperada mudar e build do workspace web passar.
