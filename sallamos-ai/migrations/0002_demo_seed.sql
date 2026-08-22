INSERT OR REPLACE INTO knowledge_document
(id, source_type, title, module, version, owner, status, source_uri, content_hash, updated_at)
VALUES
('demo:doc:formas-pagamento','doc','Manual financeiro — formas de pagamento','financeiro','4.2.0','Suporte','homologado','demo://financeiro/formas-pagamento','demo-001','2026-08-22T00:00:00Z'),
('demo:release:4.2.0','release','Release notes 4.2.0','todos','4.2.0','Tech Lead','homologado','demo://release/4.2.0','demo-002','2026-08-22T00:00:00Z'),
('demo:code:payment-method','code','PaymentMethodForm.tsx','financeiro','4.2.0','Engenharia','homologado','demo://code/PaymentMethodForm.tsx','demo-003','2026-08-22T00:00:00Z'),
('demo:doc:dre','doc','Estrutura de DRE e centros de custo','dre','4.2.0','Produto','homologado','demo://dre/estrutura','demo-004','2026-08-22T00:00:00Z'),
('demo:doc:fiscal','doc','Retenções fiscais — referência preliminar','fiscal','4.2.0',NULL,'sem_owner','demo://fiscal/retencoes','demo-005','2026-08-22T00:00:00Z');

INSERT OR REPLACE INTO knowledge_chunk
(id, document_id, chunk_index, text, symbol, path, commit_sha, module, version, hash, embedded)
VALUES
('demo:formas#0','demo:doc:formas-pagamento',0,'No módulo Financeiro, novas formas de pagamento são criadas em Financeiro > Cadastros > Formas de pagamento. Para Débito automático, o convênio bancário, banco e código do cedente devem estar preenchidos antes da emissão de guia. A opção Emite guia depende de layout compatível com o convênio.','Formas de pagamento',NULL,NULL,'financeiro','4.2.0','demo-c1',0),
('demo:formas#1','demo:release:4.2.0',0,'Na versão 4.2.0, a validação de convênio bancário passou a ser obrigatória para formas de pagamento do tipo Débito automático que emitem guia.','Release 4.2.0',NULL,NULL,'financeiro','4.2.0','demo-c2',0),
('demo:formas#2','demo:code:payment-method',0,'PaymentMethodForm valida bankId, agreementCode e assignorCode quando paymentType = debit_auto. Se emitsGuide = true, também exige guideLayout.','PaymentMethodForm','modules/financeiro/PaymentMethodForm.tsx','a91f3c2','financeiro','4.2.0','demo-c3',0),
('demo:dre#0','demo:doc:dre',0,'Após atualização para 4.2, um centro de custo pode deixar de aparecer no DRE quando estiver inativo ou sem vínculo com um grupo de resultado. A orientação homologada é validar o status do centro, o vínculo na estrutura do DRE e, se ambos estiverem corretos, recalcular o período.','Estrutura DRE',NULL,NULL,'dre','4.2.0','demo-c4',0),
('demo:fiscal#0','demo:doc:fiscal',0,'Regras de retenção fiscal dependem da parametrização do tomador, natureza do serviço, município e documento. Esta referência não possui owner homologador e não deve ser usada isoladamente para determinar imposto ou corrigir nota fiscal.','Retenções',NULL,NULL,'fiscal','4.2.0','demo-c5',0);

DELETE FROM chunk_fts WHERE chunk_id LIKE 'demo:%';
INSERT INTO chunk_fts (text, symbol, path, chunk_id) VALUES
('No módulo Financeiro, novas formas de pagamento são criadas em Financeiro Cadastros Formas de pagamento. Débito automático exige convênio bancário, banco, código do cedente e layout de guia quando houver emissão.','Formas de pagamento','','demo:formas#0'),
('Na versão 4.2.0 a validação de convênio bancário é obrigatória para Débito automático com emissão de guia.','Release 4.2.0','','demo:formas#1'),
('PaymentMethodForm valida bankId agreementCode assignorCode paymentType debit_auto emitsGuide guideLayout.','PaymentMethodForm','modules/financeiro/PaymentMethodForm.tsx','demo:formas#2'),
('Centro de custo ausente no DRE após atualização: validar ativo, vínculo com grupo de resultado e recalcular o período.','Estrutura DRE','','demo:dre#0'),
('Retenção fiscal depende da parametrização do tomador, natureza do serviço, município e documento. Fonte sem owner, uso isolado proibido.','Retenções','','demo:fiscal#0');
