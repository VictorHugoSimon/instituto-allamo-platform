-- RESET LEGADO DESATIVADO
--
-- Esta migration era usada para zerar o ambiente de homologação antes do início do uso real.
-- A partir de 2026-08-21, a plataforma opera em MODO PERSISTENTE.
--
-- REGRA: deploy não apaga empresas, projetos, demandas, tarefas, sprints, reports,
-- histórico, roadmap, usuários, auditoria ou qualquer outro dado operacional.
--
-- O conteúdo destrutivo anterior permanece disponível apenas no histórico do Git.
-- Este arquivo agora é intencionalmente NÃO DESTRUTIVO para impedir execução acidental.

SELECT 'RESET DESATIVADO — dados preservados' AS status;
