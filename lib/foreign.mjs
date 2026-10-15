import {cached} from './data.mjs';
import {num,ratio} from './analytics.mjs';
const base='https://datacenter.eastmoney.com/securities/api/data/v1/get?';
async function query(reportName,filter,columns='ALL',{sort='REPORT_DATE',pages=1}={}){
 const rows=[],sources=[];for(let page=1;page<=pages;page++){
  const url=base+new URLSearchParams({reportName,filter,columns,pageNumber:String(page),pageSize:'500',sortColumns:sort,sortTypes:'-1',source:'F10',client:'PC'}),r=await cached(url,{ttl:21600000}),j=JSON.parse(r.text);
  if(!j.result?.data?.length){if(page===1)throw Error(j.message||`${reportName} 无数据`);break;}rows.push(...j.result.data);sources.push({...r,kind:reportName});if(page>=(j.result.pages||1))break;
 }return {rows,sources};
}
const currency=s=>({'人民币':'CNY','港元':'HKD','港币':'HKD','美元':'USD','日元':'JPY','欧元':'EUR'}[s]||s||null);
export function fiscalTTM(rows,key){const a=rows[0];if(!a)return null;if(a.period==='001')return num(a[key]);const annual=rows.find(r=>r.fiscalYear===a.fiscalYear-1&&r.period==='001'),prior=rows.find(r=>r.fiscalYear===a.fiscalYear-1&&r.period===a.period);return [a[key],annual?.[key],prior?.[key]].every(v=>num(v)!==null)?Number(a[key])+Number(annual[key])-Number(prior[key]):null;}
function yearOf(r){const m=String(r.REPORT_TYPE||r.REPORT||'').match(/^(\d{4})\//);if(m)return Number(m[1]);const date=r.REPORT_DATE.slice(0,10),end=String(r.FISCAL_YEAR||'12-31').padStart(5,'0');return Number(date.slice(0,4))+(date.slice(5)>end?1:0);}
function pivot(rows){const dates={};for(const r of rows){const key=r.REPORT_DATE.slice(0,10);const d=dates[key]||(dates[key]={date:key,items:{}});d.items[r.STD_ITEM_NAME||r.ITEM_NAME]=num(r.AMOUNT);}return dates;}
const pick=(obj,...keys)=>{for(const k of keys)if(num(obj?.[k])!==null)return num(obj[k]);return null;};
export async function collectForeign(symbol){
 const hk=symbol.startsWith('HK'),ticker=hk?symbol.slice(2):symbol.slice(3),sources=[],warnings=[];let code=hk?ticker+'.HK':null,profile=null;
 if(!hk){const p=await query('RPT_USF10_INFO_ORGPROFILE',`(SECURITY_CODE="${ticker.replace(/\./g,'_')}")`,'ALL',{sort:'SECUCODE'});code=p.rows[0].SECUCODE;profile=p.rows[0];sources.push(...p.sources);}
 else{try{const p=await query('RPT_HKF10_INFO_ORGPROFILE',`(SECUCODE="${code}")`,'ALL',{sort:'SECUCODE'});profile=p.rows[0];sources.push(...p.sources);}catch(e){warnings.push('港股公司资料：'+e.message);}}
 const filter=`(SECUCODE="${code}")`,names=hk?['RPT_HKF10_FN_MAININDICATOR','RPT_HKF10_FN_BALANCE_PC','RPT_HKF10_FN_INCOME_PC','RPT_HKF10_FN_CASHFLOW_PC']:['RPT_USF10_FN_GMAININDICATOR','RPT_USF10_FN_BALANCE','RPT_USF10_FN_INCOME','RPT_USSK_FN_CASHFLOW'];
 const results=await Promise.allSettled(names.map((name,i)=>query(name,filter+(i?'(DATE_TYPE_CODE in ("001","002","003","004"))':''),i?'ALL':hk?'HKF10_FN_MAININDICATOR':'USF10_FN_GMAININDICATOR',{sort:hk&&i===0?'STD_REPORT_DATE':'REPORT_DATE',pages:i?5:1})));
 const bundles=results.map((r,i)=>{if(r.status==='fulfilled'){sources.push(...r.value.sources);return r.value.rows;}warnings.push(`${names[i]}: ${r.reason.message}`);return [];});
 if(!bundles[0].length)throw Error('境外主要财务指标不可用');let currencies=[];
 if(hk){try{const r=await query('RPT_CUSTOM_HKSK_APPFN_CASHFLOW_SUMMARY',filter,'SECUCODE,SECURITY_CODE,SECURITY_NAME_ABBR,START_DATE,REPORT_DATE,FISCAL_YEAR,CURRENCY,ACCOUNT_STANDARD,REPORT_TYPE',{sort:'SECUCODE'});currencies=r.rows[0]?.REPORT_LIST||[];sources.push(...r.sources);}catch(e){warnings.push('财报原币种校验失败，港股估值不跨币种计算');}}
 const main=bundles[0].filter(r=>['001','002','003','004'].includes(r.DATE_TYPE_CODE)).sort((a,b)=>b.REPORT_DATE.localeCompare(a.REPORT_DATE));
 const balance=pivot(bundles[1]),income=pivot(bundles[2]),cash=pivot(bundles[3]);
 const normalized=main.map(r=>{const date=r.REPORT_DATE.slice(0,10),inc=income[date]?.items||{},b=balance[date]?.items||{},c=cash[date]?.items||{};return {date,period:r.DATE_TYPE_CODE,fiscalYear:yearOf(r),revenue:pick(r,'OPERATE_INCOME','TOTAL_INCOME'),profit:pick(r,'HOLDER_PROFIT','PARENT_HOLDER_NETPROFIT'),netprofit:pick(inc,'净利润','除税后溢利','持续经营业务税后利润'),equity:pick(b,'归属于母公司股东权益','股东权益','股东权益合计'),cfo:pick(c,'经营活动产生的现金流量净额','经营业务现金净额'),capex:pick(c,'购买固定资产')===null?null:Math.abs(pick(c,'购买固定资产')),raw:r,b,inc,c};});
 const statements={balance:bundles[1],income:bundles[2],cash:bundles[3],main:bundles[0],currencyReports:currencies};
 return {sources,warnings,profile,statements,compute(quote){
  const a=normalized[0];if(!a)return {available:false,missing:['缺少有效的累计财报']};const r=a.raw,b=a.b,c=a.c;
  const prior=normalized.find(x=>x.fiscalYear===a.fiscalYear-1&&x.period===a.period),profit=fiscalTTM(normalized,'profit'),revenue=fiscalTTM(normalized,'revenue'),cfo=fiscalTTM(normalized,'cfo'),capex=fiscalTTM(normalized,'capex');
  const actualCurrency=hk?currency(currencies.find(x=>x.REPORT_DATE.startsWith(a.date))?.CURRENCY):currency(r.CURRENCY_ABBR||r.CURRENCY),sameCurrency=actualCurrency&&actualCurrency===quote.currency;
  const roe=prior&&a.equity!==null&&prior.equity!==null?ratio(profit,(a.equity+prior.equity)/2,100):null;
  const pg=pick(r,'HOLDER_PROFIT_YOY','PARENT_HOLDER_NETPROFIT_YOY'),pe=sameCurrency&&profit>0&&quote.marketCap?quote.marketCap/profit:null;
  const currentAssets=pick(b,'流动资产合计'),currentLiab=pick(b,'流动负债合计'),inventory=pick(b,'存货');
  return {available:bundles[1].length>0&&bundles[2].length>0&&bundles[3].length>0,reportDate:a.date,noticeDate:r.NOTICE_DATE?.slice(0,10)||null,currency:actualCurrency||'未核验',industry:profile?.BELONG_INDUSTRY||null,totalAssets:pick(b,'总资产'),totalLiabilities:pick(b,'总负债'),debtRatio:pick(r,'DEBT_ASSET_RATIO','DEBT_RATIO'),currentRatio:pick(r,'CURRENT_RATIO')??ratio(currentAssets,currentLiab),quickRatio:pick(r,'SPEED_RATIO')??(currentAssets!==null&&inventory!==null?ratio(currentAssets-inventory,currentLiab):null),revenueYtd:a.revenue,netProfitYtd:a.profit,deductedProfitYtd:null,revenueGrowth:pick(r,'OPERATE_INCOME_YOY','TOTAL_INCOME_YOY'),profitGrowth:pg,netMargin:pick(r,'NET_PROFIT_RATIO'),grossMargin:pick(r,'GROSS_PROFIT_RATIO'),roeTTM:roe,profitTTM:profit,revenueTTM:revenue,cfoYtd:a.cfo,cfoTTM:cfo,capexTTM:capex,fcfTTM:cfo!==null&&capex!==null?cfo-capex:null,cashProfitRatio:ratio(cfo,fiscalTTM(normalized,'netprofit')),peTTM:pe,pb:sameCurrency?ratio(quote.marketCap,a.equity):null,peg:pe>0&&pg>0?pe/pg:null,shares:null,receivablesGrowth:null,inventoryGrowth:null,cash:pick(b,'现金及现金等价物','现金及等价物'),annualHistory:normalized.filter(x=>x.period==='001').slice(0,5).map(x=>{const prev=normalized.find(p=>p.period==='001'&&p.fiscalYear===x.fiscalYear-1);return {year:x.fiscalYear,revenue:x.revenue,netProfit:x.profit,roe:prev&&x.equity!==null&&prev.equity!==null?ratio(x.profit,(x.equity+prev.equity)/2,100):null};}),dividendYield:null,notes:['境外财报按数据源财年与累计期间对齐；FY/Q1/中期/累计三季分别处理，单季 Q2/Q3/Q4 不与累计数据混用。','金额为财报原币种元；港股原币种优先使用财报摘要表校验，未校验币种不计算 PE/PB。','TTM=本累计期间+上财年全年−上财年同期；ROE TTM=TTM 归母利润/同期期初期末权益均值。','境外资本支出只在明确的“购买固定资产”项目可用时计算，其他资产购建口径不擅自合并；FCF 仍是代理值。',sameCurrency?'报价与财报币种一致；ADR、不同股类或多地上市市值覆盖范围仍需核验。':'报价与财报币种不同或原币种未知，PE/PB/PEG 留空；行情供应商 PE 另属不同口径，不替代计算。'],missing:['扣非归母净利润可比口径','最新已核验股息率','MSCI ESG 授权评级','股权质押、关联交易、诉讼及管理层变化的全面核验','境外同业估值与完整公告全文',...(sameCurrency?[]:['币种换算与 ADR / 股类对应核验'])]};
 }};
}
