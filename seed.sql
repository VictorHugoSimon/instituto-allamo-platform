-- Instituto Allamo · Portal PMO — Dados iniciais (D1)
-- Aplicar: wrangler d1 execute allamo-pmo --file=./seed.sql

INSERT INTO companies (id,name,city,system,own_system,lead,start_date,status,status_text,pmo_mode,progress,summary) VALUES
('esposende','Esposende','Recife-PE','SallamoS',1,'Renan Rondon','03/11/2025','r','Em andamento — atrasos','PMO Direto',58,'Transformar o SallamoS no sistema financeiro da Esposende.'),
('fergranos','FerGranos','','SallamoS',1,'Fábio Landin','12/06/2026','a','Reta final','PMO Indireto',82,'Implantação e operação do SallamoS.'),
('pradella','Buffet Pradella','ATA-SP','SallamoS',1,'Fábio Landin','12/06/2026','a','Em andamento','PMO Indireto',70,'Implantação e operação do SallamoS.'),
('frmarine','FR Marine Service','','SallamoS',1,'Fábio Landin','01/07/2026','g','Concluído','PMO Indireto',100,'Implantação do SallamoS.'),
('danicar','Danicar','','SallamoS',1,'Fábio Landin','12/06/2026','r','Cancelado','PMO Direto',20,'Implantação do SallamoS (cancelada, backlog aberto).'),
('centersport','Centersport','Penápolis-SP','SallamoS',1,'Victor Simon','','s','A reconciliar','PMO Direto',NULL,''),
('dual','Dual','Penápolis-SP','TOTVS',0,'Victor Simon','','s','A reconciliar','PMO Direto',NULL,''),
('oprmadri','OPR_MADRI','Itupeva-SP','Nucci',0,'Victor Simon','','s','A reconciliar','PMO Direto',NULL,''),
('pelevet','PeleVet','SJRP-SP','SallamoS',1,'Fábio Landin','','s','A reconciliar','PMO Indireto',NULL,''),
('frc','FRC','Recife-PE','SallamoS',1,'Fábio Landin','','s','A reconciliar','PMO Indireto',NULL,''),
('fillity','Fillity','São Paulo-SP','SallamoS',1,'A definir','','s','A reconciliar','Direto — TBD',NULL,''),
('famo','Famo','Tatuí-SP','SallamoS',1,'A definir','','s','A reconciliar','Direto — TBD',NULL,''),
('crismara','Crismara','Fernandópolis-SP','Nucci',0,'A definir','','s','A reconciliar','PMO Indireto',NULL,''),
('rebeka','Rebeka','SJC-SP','Sankhya',0,'A definir','','s','A reconciliar','PMO Indireto',NULL,'');

-- Usuários (senha inicial em comentário — trocar após o 1º acesso)
INSERT INTO users (name,email,password_hash,role,company_id,status) VALUES
('Renan Rondon','renan.rondon@institutoallamo.com.br','2b50d5c359d2586a174f05f4390e90d28a044eb21c3b0f8b290228ff7a0e717a','admin',NULL,'Ativo')  -- senha: allamo123,
('Fábio Landin','fabio.landin@institutoallamo.com.br','0ccbe552ae09a66562916dfa65c29ee1b012bd277a3bc378ecf65732578b3003','pmo',NULL,'Ativo')  -- senha: allamo123,
('Jadir Júnior','jadir.junior@institutoallamo.com.br','7b5275aa9e6aff9349e84d5d62b87acd11e0b57ccf15438f145ecae20c6b0c41','pmo',NULL,'Ativo')  -- senha: allamo123,
('Lucas Finistao','lucas.finistao@institutoallamo.com.br','280e4f675d20bdca3439208a056526af17a213622b021450fd1f18f91bdf8ef3','pmo',NULL,'Ativo')  -- senha: allamo123,
('Gestor Esposende','gestor@esposende.com.br','989426b3947d1444ef0311dc39d00648a3688bcff999bb1f998831faf86a28d4','gestor','esposende','Ativo')  -- senha: esposende123,
('Operação FerGranos','ti@fergranos.com.br','8acaa0cbc198f64fd5dcd8e1dcfccff8cbf48ca4455501bec113fd9ef7aa8651','usuario','fergranos','Convidado')  -- senha: fergranos123,
('Diretoria FR Marine','diretoria@frmarine.com','66e94356341d394fb31db20ed73544d605f6147c95501063c92d76ffcd7fe287','gestor','frmarine','Bloqueado')  -- senha: frmarine123;
