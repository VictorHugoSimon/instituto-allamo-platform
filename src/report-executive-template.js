(()=>{
  window.AllamoReportTemplates=window.AllamoReportTemplates||{};
  const task=(id,title,owner,status,progress,period,due_date='',notes='')=>({id,title,owner,status,progress,period,due_date,notes,client_visible:true});
  window.AllamoReportTemplates.dualClima20260828=(ctx={})=>({
    client:ctx.companyName||'Dual Clima',
    project_name:ctx.projectName||'Projeto ERP TOTVS',
    executive_summary:'Governança da implantação com foco em construção, prontidão para cargas, riscos de execução e caminho crítico até o Go-live.',
    kpis:[
      {label:'Projeto TOTVS',value:37,unit:'%',note:'37% previsto · SPI 1,0 no report de 20/08'},
      {label:'Fase 3 · Construção',value:32,unit:'%',note:'posição do cronograma detalhado · validar atualização'},
      {label:'Fichas técnicas',value:'3 / 307',unit:'',note:'baseline bruto; universo de go-live ainda deve ser definido'},
      {label:'Go-live',value:'23/11',unit:'',note:'baseline antecipado acordado TOTVS + Dual'}
    ],
    semaphores:[
      {label:'Cronograma TOTVS',state:'NO RITMO',desc:'Último Status Report oficial: 37% previsto e 37% realizado, SPI 1,0. O cronograma detalhado consultado indica 45% realizado; divergência deve ser conciliada com a TOTVS antes de consolidar o KPI.'},
      {label:'Prontidão Dual',state:'ATENÇÃO',desc:'O foco migra de desenho para execução: saneamento de cadastros, matérias-primas, intermediários, fichas técnicas, roteiros de carga/teste e preparação para o início das cargas.'},
      {label:'Marco crítico',state:'08/09 · CARGAS',desc:'A carga de cadastros começa em 08/09. O prazo de 17/09 é término da execução; portanto, a prontidão dos dados precisa ser medida antes do início da janela.'}
    ],
    risks:[
      {title:'Prontidão para cargas antes de 08/09',desc:'Cadastros críticos precisam estar saneados e roteirizados antes da abertura da janela.',meta:'Impacto Alto · PMO / Dual'},
      {title:'Fichas técnicas sem universo crítico definido',desc:'Definir imediatamente quais fichas são obrigatórias para o go-live.',meta:'Impacto Alto · PCP / Dual'},
      {title:'Roteiros de teste',desc:'Confirmar owner, volume, progresso e prazo.',meta:'Impacto Alto · Dual + TOTVS'},
      {title:'Conhecimento fiscal/tributário',desc:'Risco de dependência externa na parametrização e homologação.',meta:'Prob. Média · Impacto Alto'},
      {title:'MITs / melhorias ainda sem assinatura',desc:'A demora na revisão, aceite e formalização pode pressionar desenvolvimento, testes, UAT e caminho crítico até o Go-live.',meta:'Prob. Alta · Impacto Alto'},
      {title:'Divergência de percentual do projeto',desc:'Status Report de 20/08 registra 37% realizado; cronograma detalhado consultado indica 45%.',meta:'Governança · Validar TOTVS'}
    ],
    next:[
      {i:1,title:'Fechar baseline de prontidão dos cadastros.',desc:'Consolidar produto, matéria-prima, intermediários e fichas técnicas com total, concluído, pendente e owner.'},
      {i:2,title:'Definir o universo de fichas técnicas obrigatório para o go-live.',desc:'Substituir o indicador 3/307 por concluídas ÷ fichas críticas.'},
      {i:3,title:'Validar roteiros de carga e de testes.',desc:'Garantir aprovação e execução compatíveis com a abertura das cargas em 08/09.'},
      {i:4,title:'Atualizar matriz dos GAPs/MIT044.',desc:'Para cada item registrar assinatura, desenvolvimento, disponibilização para teste e aceite.'},
      {i:5,title:'Tratar MITs como caminho crítico.',desc:'Cobrar da TOTVS o ajuste e reenvio da FIN001 e acompanhar as demais melhorias até assinatura, desenvolvimento, teste e aceite.'},
      {i:6,title:'Consolidar pendências das capacitações.',desc:'Separar treinamento realizado de área pronta para operar.'},
      {i:7,title:'Conciliar o avanço oficial com a TOTVS.',desc:'Confirmar percentual realizado, SPI e fase vigente para o próximo report executivo.'}
    ],
    executive_report:{
      title:'Status Report · Dual Clima',
      data_base:'28/08/2026',
      subtitle:'Governança da implantação · construção, prontidão para cargas e riscos de execução',
      roadmap:[
        {date:'24/08',name:'MIT044 / GAPs',detail:'Validar entregas, assinaturas e disponibilidade para teste',status:'ATENÇÃO'},
        {date:'08/09',name:'Início das Cargas',detail:'Dados críticos precisam estar prontos antes desta data',status:'CRÍTICO',major:true},
        {date:'17/09',name:'Fim da Execução',detail:'Cadastros e cargas concluídos',status:'PLANEJADO'},
        {date:'22/09–01/10',name:'Validação das Cargas',detail:'Consistência, correções e aceite',status:'PLANEJADO'},
        {date:'OUT',name:'Testes / UAT',detail:'Movimentos, ciclos integrados e estabilização',status:'ATENÇÃO'},
        {date:'09/11',name:'Go / No-Go',detail:'Decisão executiva para entrada em produção',status:'CRÍTICO',major:true},
        {date:'23/11',name:'GO-LIVE',detail:'TOTVS Protheus em produção',status:'CONCLUÍDO',major:true}
      ],
      milestone_cards:[
        {label:'Próximo marco crítico',date:'08/09',name:'Início das cargas',desc:'Produtos, matérias-primas, intermediários, nomenclaturas e roteiro de carga precisam chegar preparados.',status:'CRÍTICO'},
        {label:'Gate executivo',date:'09/11',name:'Go / No-Go',desc:'Decisão condicionada à homologação, UAT, GAPs e prontidão operacional da Dual.',status:'ATENÇÃO'},
        {label:'Objetivo final',date:'23/11',name:'Go-live TOTVS',desc:'Data-base antecipada acordada para entrada em produção.',status:'CONCLUÍDO'}
      ],
      macro_phases:[
        {phase:'Projeto TOTVS',progress:37,remain:'63% restante · número oficial do último Status Report'},
        {phase:'Preparação Dual',progress:null,display:'A medir',remain:'Codificação concluída; MP, intermediários e fichas em andamento; estoque pendente.'},
        {phase:'Cargas',progress:0,remain:'100% restante · janela inicia 08/09'},
        {phase:'Validação',progress:0,remain:'100% restante · 22/09 a 01/10'},
        {phase:'Testes / UAT',progress:0,remain:'100% restante · roteiros ainda requerem confirmação'},
        {phase:'Go-live',progress:null,display:'23/11',remain:'Marco final · condicionado a Go/No-Go em 09/11'}
      ],
      situation:[
        {label:'Cronograma TOTVS',state:'No ritmo',desc:'37% previsto e 37% realizado, SPI 1,0 no último report oficial.',status:'CONCLUÍDO'},
        {label:'Prontidão Dual',state:'Atenção',desc:'Saneamento de cadastros, matérias-primas, intermediários, fichas e roteiros.',status:'ATENÇÃO'},
        {label:'Marco crítico',state:'08/09 · Cargas',desc:'A prontidão dos dados precisa ser medida antes do início da janela.',status:'CRÍTICO'}
      ],
      indicators:[
        {label:'Projeto TOTVS',value:'37%',note:'37% previsto · SPI 1,0 no report de 20/08'},
        {label:'Fase 3 · Construção',value:'32%',note:'posição do cronograma detalhado · validar atualização'},
        {label:'Fichas técnicas',value:'3 / 307 bruto',note:'universo de go-live ainda deve ser definido'},
        {label:'Go-live',value:'23/11',note:'baseline antecipado acordado TOTVS + Dual'}
      ],
      critical_milestones:[
        {name:'Preparação dos cadastros e cargas',date:'Até 07/09',status:'ATENÇÃO',reading:'Dados precisam estar saneados antes da janela de carga.'},
        {name:'Início das cargas',date:'08/09',status:'CRÍTICO',reading:'Primeiro grande marco de prontidão operacional da Dual.'},
        {name:'Conclusão da execução das cargas',date:'17/09',status:'PLANEJADO',reading:'Prazo informado no Status Report TOTVS.'},
        {name:'Validação das cargas',date:'22/09–01/10',status:'PLANEJADO',reading:'Janela para validar consistência e corrigir desvios.'},
        {name:'Go / No-Go',date:'09/11',status:'PLANEJADO',reading:'Decisão executiva condicionada a UAT, GAPs e prontidão.'},
        {name:'Go-live',date:'23/11',status:'BASELINE',reading:'Data antecipada formalizada no último report TOTVS.'}
      ],
      readiness:[
        {front:'Codificação de produtos',status:'EM ANDAMENTO',position:'Estrutura definida: TIPO + GRUPO + SEQUENCIAL. Saneamento e padronização de nomenclaturas em execução.',evidence:'% do cadastro saneado e aprovado.'},
        {front:'Matérias-primas / insumos',status:'EM ANDAMENTO',position:'Consolidação de chapas, bobinas, parafusos, perfis e demais matérias-primas.',evidence:'Total identificado × total estruturado.'},
        {front:'Produtos intermediários',status:'EM ANDAMENTO',position:'Frente dependente da consolidação da matéria-prima; deve alimentar ficha técnica e produto final.',evidence:'Quantidade estruturada e percentual concluído.'},
        {front:'Fichas técnicas',status:'ATENÇÃO',position:'Baseline: 3 concluídas em universo bruto de 307.',evidence:'Definir universo crítico X para go-live e medir concluídas / X.'},
        {front:'Estoque / rastreabilidade',status:'NÃO INICIADO',position:'Fluxo de consumo e rastreabilidade ainda precisa ser estruturado de ponta a ponta.',evidence:'Plano de execução + owner + data.'},
        {front:'Roteiro de cargas',status:'EM ANDAMENTO',position:'Responsabilidade Dual conforme Status Report TOTVS.',evidence:'Roteiro aprovado antes de 08/09.'},
        {front:'Roteiros de testes',status:'ATENÇÃO',position:'Atividade sob responsabilidade da Dual; cronograma detalhado consultado apresentava 0% realizado.',evidence:'Owner, quantidade total, concluídos e data de fechamento.'},
        {front:'Fiscal / tributário',status:'ATENÇÃO',position:'Capacitação realizada; existe dependência de transferência de conhecimento.',evidence:'Prática assistida + dúvidas + reforço/homologação.'}
      ],
      gaps:[
        {gap:'PCP003 · Código inteligente para geração automática da estrutura de produto',module:'PCP',reference:'Entrega MIT044 prevista 24/08',control:'VALIDAR assinatura, desenvolvimento e data para teste.'},
        {gap:'PCP007 · Apontamento de produção / etiquetas / rastreabilidade',module:'PCP',reference:'Entrega MIT044 prevista 24/08',control:'VALIDAR status de desenvolvimento.'},
        {gap:'FIN001 · Boleto e cobrança automática por e-mail',module:'Financeiro',reference:'Avaliada pela Dual e devolvida para ajuste na MIT',control:'EM AJUSTE · TOTVS deve revisar e reenviar.'},
        {gap:'Custo dos produtos no cálculo de comissão',module:'Faturamento',reference:'Entrega MIT044 prevista 20/08',control:'VALIDAR disponibilidade para testes.'},
        {gap:'Pedido de compra na Origem e pedido de venda na Dual',module:'Faturamento',reference:'Entrega MIT044 prevista 20/08',control:'VALIDAR escopo e cronograma de teste.'}
      ],
      trainings:[
        {front:'Estoque + App Minha Produção',position:'Realizada',reading:'Transformar treinamento em processo operacional e rastreabilidade.'},
        {front:'PCP',position:'Realizada',reading:'Conectar parametrização, intermediários, fichas técnicas e apontamento.'},
        {front:'Financeiro',position:'Capacitação prevista/realizada no ciclo',reading:'FIN001 devolvida para ajuste da MIT; aguardar reenvio TOTVS.'},
        {front:'Fiscal · geração SPED',position:'Capacitação no ciclo',reading:'Requer reforço de conhecimento interno e prática assistida.'},
        {front:'Contabilidade gerencial',position:'Capacitação no ciclo',reading:'Confirmar absorção, dúvidas e ações pós-treinamento.'}
      ]
    },
    live_task_board:{
      title:'Cadência Integrada · Responsável, progresso e prazo',
      periods:[
        {id:'p1',label:'Até 28/08'},{id:'p2',label:'31/08–07/09'},{id:'p3',label:'08–17/09'},
        {id:'p4',label:'22/09–01/10'},{id:'p5',label:'OUT'},{id:'p6',label:'09/11'},{id:'p7',label:'23/11'}
      ],
      lanes:[
        {id:'dual',name:'DUAL',subtitle:'Execução interna',tasks:[
          task('dual-01','Codificação de produtos','Luiz','CONCLUIDO',100,'p1','','Finalizado'),
          task('dual-02','MP / insumos','Luiz + equipe operacional','EM_ANDAMENTO',0,'p1','','Prazo: consolidar nesta janela'),
          task('dual-03','Fichas técnicas','Produção + Luiz','EM_ANDAMENTO',1,'p1','','3 concluídas / universo Go-live a definir'),
          task('dual-04','Intermediários','Luiz + Produção','EM_ANDAMENTO',0,'p1','','Dependência: matéria-prima'),
          task('dual-05','Estoque / rastreabilidade','A definir com Luiz','BLOQUEADO',0,'p1','','Sem prazo confirmado'),
          task('dual-06','Saneamento de nomenclaturas','Luiz','EM_ANDAMENTO',0,'p2','07/09/2026','Até 07/09'),
          task('dual-07','Fichas críticas do Go-live','Luiz + Produção','EM_ANDAMENTO',0,'p2','07/09/2026','Medir após definir universo crítico'),
          task('dual-08','Produtos intermediários','Luiz + Produção','PLANEJADO',0,'p2','07/09/2026','A medir'),
          task('dual-09','Roteiro de cargas','Dual / owner nominal a confirmar','BLOQUEADO',0,'p2','08/09/2026','Aprovar antes de 08/09'),
          task('dual-10','Cadastros e cargas','Dual + key users','PLANEJADO',0,'p3','17/09/2026','Janela 08–17/09'),
          task('dual-11','Validação dos dados','Dual + key users','PLANEJADO',0,'p4','01/10/2026','Janela 22/09–01/10'),
          task('dual-12','Movimentos + UAT','Key users Dual','PLANEJADO',0,'p5','','Outubro'),
          task('dual-13','Roteiros de teste','Dual / owner nominal a confirmar','BLOQUEADO',0,'p5','','0% no cronograma consultado'),
          task('dual-14','Aprovar prontidão','Luiz + gestão Dual','PLANEJADO',0,'p6','09/11/2026','Go / No-Go'),
          task('dual-15','Operação em produção','Dual','PLANEJADO',0,'p7','23/11/2026','Go-live')
        ]},
        {id:'totvs',name:'TOTVS',subtitle:'Implantação',tasks:[
          task('totvs-01','Capacitações iniciais','Consultores TOTVS','CONCLUIDO',100,'p1','','Concluídas conforme agendas realizadas'),
          task('totvs-02','Fiscal / Financeiro / Contábil','Consultores TOTVS','EM_ANDAMENTO',0,'p1','','Em ciclo de capacitação'),
          task('totvs-03','MITs / GAPs','TOTVS + validação Dual','EM_ANDAMENTO',0,'p1','','A medir por MIT'),
          task('totvs-04','Apoio aos cadastros','Consultores TOTVS','PLANEJADO',0,'p2','','Até abertura das cargas'),
          task('totvs-05','Desenvolvimento dos GAPs','TOTVS','EM_ANDAMENTO',0,'p2','','A medir por GAP'),
          task('totvs-06','Suporte às cargas','TOTVS','PLANEJADO',0,'p3','17/09/2026','08–17/09'),
          task('totvs-07','Suporte à validação','TOTVS','PLANEJADO',0,'p4','01/10/2026','22/09–01/10'),
          task('totvs-08','Capacitação movimentos / UAT','Consultores TOTVS','PLANEJADO',0,'p5','','Outubro'),
          task('totvs-09','Evidências técnicas','TOTVS','PLANEJADO',0,'p6','09/11/2026','Até Go / No-Go'),
          task('totvs-10','Suporte ao Go-live','TOTVS','PLANEJADO',0,'p7','23/11/2026','Go-live')
        ]},
        {id:'allamo',name:'ÁLLAMO / PMO',subtitle:'Governança',tasks:[
          task('allamo-01','Roadmap / recorte PMO','Victor / Államo','CONCLUIDO',100,'p1','','Baseline concluída'),
          task('allamo-02','Riscos iniciais','Victor / Államo','CONCLUIDO',100,'p1','','Baseline concluída'),
          task('allamo-03','Readiness Dual','Victor + Luiz','EM_ANDAMENTO',0,'p1','','Em medição'),
          task('allamo-04','Owners e prazos','Victor + Luiz','PLANEJADO',0,'p2','07/09/2026','Parcial'),
          task('allamo-05','Medir prontidão','Victor / Államo','PLANEJADO',0,'p2','','A consolidar'),
          task('allamo-06','Monitorar caminho crítico','Victor / Államo','PLANEJADO',0,'p3','17/09/2026','08–17/09'),
          task('allamo-07','Desvios e decisões','Victor / Államo','PLANEJADO',0,'p4','01/10/2026','22/09–01/10'),
          task('allamo-08','Governança de testes','Victor / Államo','PLANEJADO',0,'p5','','Outubro'),
          task('allamo-09','Readiness / Go-No-Go','Victor + Luiz + gestão','PLANEJADO',0,'p6','09/11/2026','Gate executivo'),
          task('allamo-10','Governança Go-live','Victor / Államo','PLANEJADO',0,'p7','23/11/2026','Entrada em produção')
        ]}
      ]
    }
  });
})();
