window.SEMEALI_MARKET_DATA={
  version:'v3 · 03/09/2026',
  scope:'Base piloto de 11 municípios prioritários. Não representa cobertura nacional completa.',
  sources:['PAM 2024','CONAB 2025/26','MapBiomas Coleção 11','ZARC 2026/27'],
  kpis:{municipios:11,sojaHa:3768594,milhoHa:1704250,sorgoHa:203317,pastagemReduzidaHa:73450.2,graosAreaMha:83.5,sojaMt:180.5,milhoMt:143,milho2Mt:111,sorgoMt:7.5},
  rankings:{
    soja:[['São Desidério/BA',82.2,'MÁXIMA'],['Rio Verde/GO',66.5,'ALTA'],['Sorriso/MT',62.8,'MÉDIA'],['Nova Mutum/MT',58.4,'MÉDIA'],['Barreiras/BA',57.1,'MÉDIA']],
    milho:[['Sorriso/MT',80.3,'MÁXIMA'],['Rio Verde/GO',71.3,'ALTA'],['Nova Mutum/MT',64.3,'MÉDIA'],['Cristalina/GO',46.5,'SELETIVA'],['Campo Novo do Parecis/MT',44.7,'SELETIVA']],
    sorgo:[['Cristalina/GO',83.7,'MÁXIMA'],['Rio Verde/GO',72.7,'ALTA'],['Unaí/MG',54,'MÉDIA'],['Paracatu/MG',45,'SELETIVA'],['São Desidério/BA',44.6,'SELETIVA']]
  },
  territories:[
    {municipio:'Sorriso',uf:'MT',bioma:'Amazônia/Cerrado',agric2020:566501.3,agric2025:570759,soja2020:525604.8,soja2025:552634.5,pastagemReducao:2754.8,pamSoja:600000,pamMilho:500000,pamSorgo:null,scoreSoja:62.8,scoreMilho:80.3,scoreSorgo:20.8,melhor:'MILHO',prioridade:'MÁXIMA',acao:'Ofensiva milho safrinha; usar soja como porta de entrada e validar ZARC.'},
    {municipio:'São Desidério',uf:'BA',bioma:'Cerrado',agric2020:589625.4,agric2025:699955.2,soja2020:357866.6,soja2025:511727.8,pastagemReducao:0,pamSoja:508448,pamMilho:35251,pamSorgo:18900,scoreSoja:82.2,scoreMilho:43.1,scoreSorgo:44.6,melhor:'SOJA',prioridade:'MÁXIMA',acao:'Prospectar soja e validar cultivar, REC e ZARC municipal.'},
    {municipio:'Rio Verde',uf:'GO',bioma:'Cerrado',agric2020:470714.8,agric2025:477236.2,soja2020:386491,soja2025:447289,pastagemReducao:20857.8,pamSoja:425000,pamMilho:334300,pamSorgo:53000,scoreSoja:66.5,scoreMilho:71.3,scoreSorgo:72.7,melhor:'SORGO',prioridade:'ALTA',acao:'Campanha integrada soja + milho + sorgo; explorar sorgo granífero e TOPSILO.'},
    {municipio:'Cristalina',uf:'GO',bioma:'Cerrado',agric2020:274636.2,agric2025:282916,soja2020:261510.3,soja2025:274741.8,pastagemReducao:11077.2,pamSoja:338000,pamMilho:99700,pamSorgo:65000,scoreSoja:52.3,scoreMilho:46.5,scoreSorgo:83.7,melhor:'SORGO',prioridade:'MÁXIMA',acao:'Criar polo demonstrativo de sorgo com revendas, técnicos e dias de campo.'},
    {municipio:'Barreiras',uf:'BA',bioma:'Caatinga/Cerrado',agric2020:278011.6,agric2025:324347.7,soja2020:220145.2,soja2025:270881.7,pastagemReducao:1237.7,pamSoja:234596,pamMilho:12004,pamSorgo:6417,scoreSoja:57.1,scoreMilho:33.7,scoreSorgo:34.5,melhor:'SOJA',prioridade:'MÉDIA',acao:'Prospectar soja e canais do Oeste da Bahia.'},
    {municipio:'Sapezal',uf:'MT',bioma:'Amazônia/Cerrado',agric2020:419636.6,agric2025:422180.7,soja2020:359550.3,soja2025:389283.5,pastagemReducao:0,pamSoja:398550,pamMilho:93835,pamSorgo:null,scoreSoja:50.6,scoreMilho:40.7,scoreSorgo:18.9,melhor:'SOJA',prioridade:'MÉDIA',acao:'Mercado maduro: foco em ganho de share e contas de maior valor.'},
    {municipio:'Nova Mutum',uf:'MT',bioma:'Amazônia/Cerrado',agric2020:452145.9,agric2025:463342.5,soja2020:391423.3,soja2025:427008.1,pastagemReducao:12902.7,pamSoja:402000,pamMilho:298000,pamSorgo:3000,scoreSoja:58.4,scoreMilho:64.3,scoreSorgo:28.7,melhor:'MILHO',prioridade:'MÉDIA',acao:'Ofensiva milho safrinha e captura de conversão de pastagem.'},
    {municipio:'Campo Novo do Parecis',uf:'MT',bioma:'Amazônia/Cerrado',agric2020:412356.4,agric2025:414938.8,soja2020:332807,soja2025:382265,pastagemReducao:536,pamSoja:408000,pamMilho:141300,pamSorgo:2000,scoreSoja:54.4,scoreMilho:44.7,scoreSorgo:20.7,melhor:'SOJA',prioridade:'MÉDIA',acao:'Prospectar soja em mercado consolidado e validar canais.'},
    {municipio:'Paracatu',uf:'MG',bioma:'Cerrado',agric2020:196316.4,agric2025:211767,soja2020:143269,soja2025:153635.9,pastagemReducao:18766.2,pamSoja:122000,pamMilho:25000,pamSorgo:10000,scoreSoja:46.7,scoreMilho:41,scoreSorgo:45,melhor:'SOJA',prioridade:'SELETIVA',acao:'Explorar intensificação agrícola e validar aderência por cultura.'},
    {municipio:'Unaí',uf:'MG',bioma:'Cerrado',agric2020:194133.8,agric2025:203578.5,soja2020:163935.7,soja2025:174537.8,pastagemReducao:2665.8,pamSoja:187000,pamMilho:51500,pamSorgo:30000,scoreSoja:40.4,scoreMilho:35,scoreSorgo:54,melhor:'SORGO',prioridade:'MÉDIA',acao:'Campanha de sorgo e validação de demanda local.'},
    {municipio:'Montividiu',uf:'GO',bioma:'Cerrado',agric2020:137639.9,agric2025:138478.3,soja2020:131817.3,soja2025:136746.6,pastagemReducao:2652,pamSoja:145000,pamMilho:113360,pamSorgo:15000,scoreSoja:22,scoreMilho:24.3,scoreSorgo:27.5,melhor:'SORGO',prioridade:'WATCHLIST',acao:'Validar score territorial e crescimento recente do sorgo antes de escalar.'}
  ],
  thesis:[
    {territorio:'São Desidério/BA',score:82.2,cultura:'Soja',fato:'+43,0% soja MapBiomas 2020–2025',tese:'Capturar expansão do Oeste da Bahia',produto:'Linha soja Semeali',canal:'Revendas/cooperativas',risco:'ESG/hídrico',prioridade:'MÁXIMA'},
    {territorio:'Sorriso/MT',score:80.3,cultura:'Milho',fato:'500 mil ha milho PAM 2024',tese:'Soja como porta de entrada para safrinha',produto:'SLI 6444PRO4 + portfólio milho',canal:'Distribuição + grandes produtores',risco:'Competição alta',prioridade:'MÁXIMA'},
    {territorio:'Cristalina/GO',score:83.7,cultura:'Sorgo',fato:'65 mil ha sorgo PAM 2024',tese:'Criar polo demonstrativo de sorgo',produto:'RANCHERO / SLI6022 / TOPSILO',canal:'Revendas + técnicos + dias de campo',risco:'Execução técnica',prioridade:'MÁXIMA'},
    {territorio:'Rio Verde/GO',score:72.7,cultura:'Sorgo',fato:'425k soja + 334,3k milho + 53k sorgo',tese:'Conta territorial tri-cultura',produto:'Soja + milho + sorgo',canal:'Cooperativas/revendas',risco:'Competição alta',prioridade:'ALTA'},
    {territorio:'Nova Mutum/MT',score:64.3,cultura:'Milho',fato:'12,9 mil ha de redução de pastagem em 5 anos',tese:'Crescer share em soja → milho',produto:'Portfólio soja + milho',canal:'Distribuição',risco:'Competição alta',prioridade:'MÉDIA'}
  ],
  roadmap:[
    ['Dias 1–15','Validação da base','Revalidar PAM 2024 no SIDRA; preencher preços R$/ha; carregar clientes e representantes','EM ANDAMENTO'],
    ['Dias 16–30','Escala MapBiomas','Aplicar Coleção 11 aos municípios-alvo e incorporar frequência de 2/3 ciclos','PLANEJADO'],
    ['Dias 31–45','Scores nacionais','Gerar Score Soja, Milho e Sorgo por município','PLANEJADO'],
    ['Dias 46–60','Canais e concorrência','Mapear cooperativas, revendas, distribuidores e concorrentes nos Top 100','PLANEJADO'],
    ['Dias 61–75','Piloto comercial','Piloto GO + Oeste BA + MT + Noroeste MG','PLANEJADO'],
    ['Dias 76–90','Escala e forecast','Dashboard executivo, TAM/SOM, forecast e fila diária de prospecção','PLANEJADO']
  ]
};
