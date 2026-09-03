# Semeali White-Label Sales Intelligence — V1

## Objetivo

Transformar a base Államo em uma plataforma multiempresa white-label e entregar a Semeali como primeiro tenant comercial, preservando isolamento de dados, identidade própria, governança de acesso e evolução modular.

## Princípios

1. A Államo administra a plataforma; cada cliente opera somente dentro do seu tenant.
2. Usuários nunca escolhem `tenantId` por payload; o contexto vem da associação autenticada.
3. Convites são individuais, vinculados ao e-mail, expiram e armazenam somente hash do token.
4. Nenhuma senha é compartilhada por administradores.
5. A experiência visual e os módulos são selecionados por tenant.
6. Dados demonstrativos devem ser explicitamente identificados como demonstração.
7. Regras críticas de preço, desconto, crédito e aprovação permanecem governadas por perfil, alçada e auditoria.
8. A solução reutiliza conceitos funcionais de sistemas de referência, sem transportar nomes, identidade visual ou marca de terceiros.

## Arquitetura entregue nesta branch

### Államo Control Center

- cadastro de empresas white-label;
- listagem de tenants;
- quantidade de usuários ativos por tenant;
- visualização dos usuários de cada cliente;
- criação de convite por e-mail e perfil;
- cancelamento de convite;
- link de acesso exibido somente no momento da criação;
- bootstrap inicial restrito ao proprietário da organização Államo;
- trilha de auditoria para criação de tenant e convites.

### Governança de acesso por tenant

Perfis-base:

- Proprietário;
- Administrador;
- Gestor;
- Colaborador.

Fluxo de compartilhamento:

1. Államo ou administrador autorizado seleciona o tenant.
2. Informa e-mail e perfil.
3. O backend gera token aleatório e grava apenas o SHA-256.
4. O sistema devolve um link `/convite?token=...` uma única vez.
5. O convidado entra ou cria conta com o mesmo e-mail.
6. O aceite valida token, expiração e e-mail autenticado.
7. A associação do usuário com a organização é criada.
8. O papel é atribuído.
9. O evento é gravado na auditoria.
10. O usuário entra no painel do tenant.

## Experiência Semeali

Tenant de referência: `semeali`

Produto: `Sales Intelligence`

### 1. Visão geral

- meta e cobertura;
- prospects;
- leads qualificados;
- pipeline potencial;
- hectares em oportunidade;
- funil comercial;
- recomendações priorizadas.

### 2. Oportunidades

- busca e filtros;
- cultura;
- score;
- potencial;
- estágio;
- preparação de abordagem;
- próxima melhor ação.

### 3. Mercado e território

- ranking regional;
- potencial por região;
- cobertura comercial;
- hectares;
- leads sem contato;
- rotas;
- redistribuição de carteira;
- campanhas regionais.

### 4. Carteira e CRM

- conta;
- localização;
- cultura de interesse;
- score;
- potencial;
- estágio;
- histórico;
- último contato;
- próxima ação.

### 5. Vendas e aprovações

- tabela de preços;
- comissões;
- descontos por alçada;
- pedidos;
- perdas e motivos;
- política comercial;
- política de crédito;
- preparação para integração com ERP.

### 6. Execução em campo

- agenda e rotas;
- projeção semanal;
- plano de ação;
- relatório de visita;
- evidências e anexos;
- mapa da equipe com consentimento e uso em sessão;
- registro de perdas.

### 7. Atendimento

- reclamações;
- protocolos técnicos;
- chamados internos;
- frete;
- acompanhamento de carga e entrega;
- SLA e histórico.

### 8. Conteúdo e engajamento

- campanhas;
- materiais técnicos;
- treinamentos;
- políticas versionadas;
- notificações e confirmação de leitura;
- gamificação orientada a ações relevantes.

### 9. Agentes de IA

- Radar de Mercado;
- Qualificador de Leads;
- Planejador Territorial;
- Copiloto do Representante;
- Gestor de Campanhas;
- Copiloto Executivo.

A IA recomenda e prioriza. Decisões sensíveis continuam sujeitas a regras, permissões, alçadas e fontes oficiais.

### 10. Executivo

- cobertura de meta;
- pipeline sobre gap;
- conversão projetada;
- ciclo médio;
- pipeline por cultura;
- alertas executivos;
- adoção da plataforma;
- principais perdas e desvios.

## Estado técnico da V1

### Implementado na branch

- tenant catalog no frontend;
- experiência específica para `semeali`;
- dashboard Semeali;
- workspace comercial interativo demonstrativo;
- página de cadastro real;
- página de aceite de convite;
- gestão de usuários e acessos no tenant;
- Control Center Államo;
- fundação de administração da plataforma;
- RPCs seguras para membros e convites;
- auditoria de ações críticas.

### Próximas camadas depois da homologação da V1

1. substituir datasets demonstrativos por tabelas multi-tenant reais;
2. criar entidades comerciais: contas, leads, oportunidades, visitas, rotas e campanhas;
3. conectar ERP e fontes externas autorizadas;
4. adicionar georreferenciamento real;
5. implementar notificações e confirmação de leitura;
6. criar armazenamento de anexos/evidências;
7. implementar motor de alçadas comerciais configurável;
8. instrumentar telemetria e adoção;
9. conectar os agentes de IA a dados homologados;
10. publicar ambiente de stage exclusivo para homologação Semeali.

## Critério de segurança

Nenhum recurso de outro cliente deve ser reutilizado como dado, segredo, banco ou configuração do tenant Semeali. Compartilhamento é permitido apenas no nível de código-base e componentes genéricos da plataforma Államo.
