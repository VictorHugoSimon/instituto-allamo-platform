# Restauração destrutiva de Stage desativada

O fluxo legado `scripts/restore-stage-baseline-three.cmd` e o SQL `ops/stage/restore-baseline-three-companies.sql` foram neutralizados.

## Regra permanente

- Deploy de Stage não restaura baseline.
- Deploy não exclui empresas, projetos, reports, arquivos, campos dinâmicos, Work Management ou demais dados persistidos.
- `RESTAURAR-STAGE-3` não é mais um comando operacional válido.
- Recuperação de dados, quando realmente necessária, deve partir de backup explícito e de um procedimento de recuperação revisado separadamente; nunca de um script embutido no deploy.
- Produção nunca deve executar arquivos sob `ops/stage/`.

Os arquivos legados são mantidos apenas como marcadores de compatibilidade/rastreabilidade e devem permanecer não destrutivos.
