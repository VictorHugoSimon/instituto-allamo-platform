// Semeali — sinais públicos de mercado e clima para o portal dedicado.
// Não expõe dados de tenant e não depende de credenciais pagas.
const semealiPublicJson=(body,status=200,cache='public, max-age=120')=>new Response(JSON.stringify(body),{
  status,
  headers:{'content-type':'application/json; charset=utf-8','cache-control':cache}
});

const semealiFetchJson=async(target,timeoutMs=8000)=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(target,{
      signal:controller.signal,
      headers:{'accept':'application/json','user-agent':'Semeali-Intelligence/1.0'},
      cf:{cacheEverything:true,cacheTtl:120}
    });
    if(!response.ok)throw new Error('upstream_'+response.status);
    return await response.json();
  }finally{clearTimeout(timer)}
};

if(path==='semeali-live-market'&&request.method==='GET'){
  const assets=[
    {id:'soy',symbol:'ZS=F',label:'Soja CBOT',crop:'SOJA',unit:'¢/bushel'},
    {id:'corn',symbol:'ZC=F',label:'Milho CBOT',crop:'MILHO',unit:'¢/bushel'},
    {id:'usdbrl',symbol:'USDBRL=X',label:'Dólar / Real',crop:'MACRO',unit:'BRL por USD'}
  ];
  const quote=async asset=>{
    try{
      const endpoint='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(asset.symbol)+'?interval=5m&range=1d';
      const payload=await semealiFetchJson(endpoint,7000);
      const result=payload?.chart?.result?.[0];
      const meta=result?.meta||{};
      const price=Number(meta.regularMarketPrice);
      const previous=Number(meta.chartPreviousClose??meta.previousClose);
      const change=Number.isFinite(price)&&Number.isFinite(previous)?price-previous:null;
      const changePct=change!=null&&previous?change/previous*100:null;
      return {...asset,status:Number.isFinite(price)?'ok':'unavailable',price:Number.isFinite(price)?price:null,previous:Number.isFinite(previous)?previous:null,change,change_pct:changePct,currency:meta.currency||null,exchange:meta.exchangeName||null,market_time:meta.regularMarketTime?new Date(meta.regularMarketTime*1000).toISOString():null};
    }catch(error){
      return {...asset,status:'unavailable',price:null,previous:null,change:null,change_pct:null,error:String(error?.message||'upstream_error').slice(0,120)};
    }
  };
  const quotes=await Promise.all(assets.map(quote));
  const corn=quotes.find(x=>x.id==='corn');
  const sorghum={
    id:'sorghum_proxy',symbol:null,label:'Sorgo · referência milho',crop:'SORGO',unit:corn?.unit||'¢/bushel',status:corn?.status||'unavailable',price:corn?.price??null,previous:corn?.previous??null,change:corn?.change??null,change_pct:corn?.change_pct??null,currency:corn?.currency??null,exchange:corn?.exchange??null,market_time:corn?.market_time??null,proxy:true,proxy_for:'ZC=F'
  };
  const signal=(q,up,down)=>q?.status!=='ok'?'Fonte temporariamente indisponível':(q.change_pct>=1?up:(q.change_pct<=-1?down:'Movimento moderado no pregão'));
  const insights=[
    {crop:'SOJA',title:'Soja',text:signal(quotes.find(x=>x.id==='soy'),'Alta relevante no pregão: monitore potencial de investimento do produtor e timing comercial.','Queda relevante no pregão: reforce qualificação por margem, custo e janela de plantio.')},
    {crop:'MILHO',title:'Milho',text:signal(corn,'Alta relevante no pregão: acompanhe intenção de área e oportunidades de milho/safrinha.','Queda relevante no pregão: priorize contas com melhor score e necessidade técnica clara.')},
    {crop:'SORGO',title:'Sorgo',text:'Sem contrato futuro líquido de referência no painel; o milho é exibido apenas como proxy de contexto, não como preço de sorgo.'},
    {crop:'MACRO',title:'Câmbio',text:signal(quotes.find(x=>x.id==='usdbrl'),'Dólar em alta: acompanhe impacto sobre custos dolarizados e poder de compra no agro.','Dólar em queda: acompanhe possível alívio em custos dolarizados e reposicionamento de margens.')}
  ];
  return semealiPublicJson({
    ok:true,
    as_of:new Date().toISOString(),
    refresh_seconds:300,
    delayed_or_indicative:true,
    provider:'Yahoo Finance public market data',
    exchange_context:['CME/CBOT','FX'],
    quotes:[...quotes,sorghum],
    insights,
    notice:'Cotações para inteligência comercial; podem ter atraso e não substituem feed oficial/licenciado de bolsa.'
  });
}

const SEMEALI_UF={AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins'};

if(path==='semeali-weather'&&request.method==='GET'){
  const city=String(url.searchParams.get('city')||'Araçatuba').replace(/[^\p{L}\p{N}\s.'-]/gu,'').trim().slice(0,80)||'Araçatuba';
  const state=String(url.searchParams.get('state')||'SP').replace(/[^A-Za-z]/g,'').toUpperCase().slice(0,2)||'SP';
  let latitude=Number(url.searchParams.get('lat')),longitude=Number(url.searchParams.get('lon')),locationName=city,admin1=SEMEALI_UF[state]||state;
  try{
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude)){
      const geoUrl='https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(city)+'&count=10&language=pt&format=json&countryCode=BR';
      const geo=await semealiFetchJson(geoUrl,7000);
      const wanted=(SEMEALI_UF[state]||'').toLocaleLowerCase('pt-BR');
      const candidates=Array.isArray(geo?.results)?geo.results:[];
      const chosen=candidates.find(x=>String(x.admin1||'').toLocaleLowerCase('pt-BR')===wanted)||candidates[0];
      if(!chosen)return semealiPublicJson({error:'Cidade não encontrada'},404,'no-store');
      latitude=Number(chosen.latitude);longitude=Number(chosen.longitude);locationName=chosen.name||city;admin1=chosen.admin1||admin1;
    }
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<-90||latitude>90||longitude<-180||longitude>180)return semealiPublicJson({error:'Coordenadas inválidas'},400,'no-store');
    const params=new URLSearchParams({
      latitude:String(latitude),longitude:String(longitude),timezone:'America/Sao_Paulo',forecast_days:'7',
      current:'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m',
      hourly:'soil_temperature_0cm,soil_moisture_0_to_1cm',
      daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,et0_fao_evapotranspiration'
    });
    const forecast=await semealiFetchJson('https://api.open-meteo.com/v1/forecast?'+params.toString(),8000);
    const hour=String(forecast?.current?.time||'').slice(0,13);
    const hourlyTimes=forecast?.hourly?.time||[];
    const hourIndex=Math.max(0,hourlyTimes.findIndex(x=>String(x).slice(0,13)===hour));
    const current={...(forecast?.current||{}),soil_temperature_0cm:forecast?.hourly?.soil_temperature_0cm?.[hourIndex]??null,soil_moisture_0_to_1cm:forecast?.hourly?.soil_moisture_0_to_1cm?.[hourIndex]??null};
    const dates=forecast?.daily?.time||[];
    const daily=dates.map((date,index)=>({
      date,weather_code:forecast.daily.weather_code?.[index]??null,
      temp_max:forecast.daily.temperature_2m_max?.[index]??null,temp_min:forecast.daily.temperature_2m_min?.[index]??null,
      precipitation_probability_max:forecast.daily.precipitation_probability_max?.[index]??null,precipitation_sum:forecast.daily.precipitation_sum?.[index]??null,
      wind_speed_max:forecast.daily.wind_speed_10m_max?.[index]??null,wind_gusts_max:forecast.daily.wind_gusts_10m_max?.[index]??null,
      et0:forecast.daily.et0_fao_evapotranspiration?.[index]??null
    }));
    const rain7=daily.reduce((sum,d)=>sum+Number(d.precipitation_sum||0),0);
    const maxProb=Math.max(0,...daily.map(d=>Number(d.precipitation_probability_max||0)));
    const operationalSignal=rain7>=40?'Chuva acumulada relevante nos próximos 7 dias: revisar janelas de visita e potencial de plantio.':rain7<=10?'Previsão mais seca nos próximos 7 dias: atenção a implantação, umidade e abordagem técnica.':'Condição intermediária de chuva: acompanhar diariamente e ajustar rotas de campo.';
    return semealiPublicJson({
      ok:true,provider:'Open-Meteo',as_of:new Date().toISOString(),timezone:forecast.timezone||'America/Sao_Paulo',
      location:{name:locationName,state:admin1,latitude,longitude,elevation:forecast.elevation??null},
      current,daily,
      agriculture:{rain_7d_mm:Number(rain7.toFixed(1)),max_precip_probability_7d:maxProb,operational_signal:operationalSignal},
      notice:'Previsão meteorológica é probabilística e deve ser reavaliada antes de decisões agronômicas ou operacionais.'
    });
  }catch(error){
    return semealiPublicJson({error:'Não foi possível carregar a previsão do tempo',detail:String(error?.message||'upstream_error').slice(0,120)},502,'no-store');
  }
}
