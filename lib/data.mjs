import { createHash } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { fundamentals,technical,assess,num } from './analytics.mjs';
import {indexOf} from './instruments.mjs';
const UA='Mozilla/5.0 StockResearchLab/1.0';
const now=()=>new Date().toISOString();
export async function cached(url,{ttl=900000,encoding='utf-8'}={}){
 await mkdir('data/cache',{recursive:true});const file=`data/cache/${createHash('sha256').update(url).digest('hex')}.json`;let old;
 try{old=JSON.parse(await readFile(file,'utf8'));if(Date.now()-old.time<ttl)return {...old,cache:true};}catch{}
 let last;for(let n=0;n<2;n++){try{const r=await fetch(url,{headers:{'User-Agent':UA,Referer:'https://finance.eastmoney.com/'},signal:AbortSignal.timeout(16000)});if(!r.ok)throw Error(`HTTP ${r.status}`);const text=new TextDecoder(encoding).decode(await r.arrayBuffer());if(text.length<3)throw Error('数据源返回空响应');const item={text,time:Date.now(),fetchedAt:now(),url,stale:false};await writeFile(file,JSON.stringify(item));return item;}catch(e){last=e;}}
 if(old)return {...old,cache:true,stale:true,error:`刷新失败，使用历史缓存：${last.message}`};throw last;
}
export function normalizeSymbol(input){
 const s=String(input||'').trim().toUpperCase();
 if(indexOf(s)||/^BOARD:BK\d{4,6}$/.test(s))return s;
 if(/^US:[A-Z][A-Z0-9._-]{0,11}$/.test(s))return s;
 if(/^(SH|SZ|BJ)\d{6}$/.test(s))return s;
 if(/^\d{6}(\.(SH|SZ|BJ))?$/.test(s)){const [c,e]=s.split('.');return (e||(/^92/.test(c)?'BJ':/^[569]/.test(c)?'SH':/^[48]/.test(c)?'BJ':'SZ'))+c;}
 if(/^\d{1,5}(\.HK)?$/.test(s))return 'HK'+s.split('.')[0].padStart(5,'0');
 if(/^HK\d{5}$/.test(s))return s;
 if(/^[A-Z][A-Z0-9._-]{0,11}$/.test(s))return 'US:'+s;
 throw Error('请输入代码，如 600519、000001、00700.HK、AAPL');
}
export async function searchStocks(q){
 if(!q||q.length>40)return [];
 const url='https://searchapi.eastmoney.com/api/suggest/get?'+new URLSearchParams({input:q,type:'14',count:'10'});
 const r=await cached(url,{ttl:86400000}),j=JSON.parse(r.text);
 return (j.QuotationCodeTable?.Data||[]).map(x=>({code:x.Code,name:x.Name,quoteId:x.QuoteID,market:x.MarketType}));
}
async function report(name,code,count=28,extra=''){
 const url='https://datacenter-web.eastmoney.com/api/data/v1/get?'+new URLSearchParams({reportName:name,columns:'ALL',filter:extra||`(SECUCODE="${code}")`,pageSize:String(count),sortColumns:'REPORT_DATE',sortTypes:'-1'}),r=await cached(url,{ttl:21600000}),j=JSON.parse(r.text);
 if(!j.success||!j.result?.data?.length)throw Error(j.message||'财报数据为空');return {rows:j.result.data,source:r};
}
async function extraReport(reportName,filter,sortColumns='',count=40){
 const url='https://datacenter.eastmoney.com/securities/api/data/v1/get?'+new URLSearchParams({reportName,columns:'ALL',filter,pageSize:String(count),sortColumns,sortTypes:sortColumns?'-1':'',source:'F10',client:'PC'}),r=await cached(url,{ttl:21600000}),j=JSON.parse(r.text);
 if(!j.result?.data?.length)throw Error(j.message||`${reportName} 数据为空`);return {rows:j.result.data,source:r};
}
async function getBars(symbol){
 const {resolveSecid}=await import('./market.mjs');const secid=await resolveSecid(symbol);
 const url='https://push2his.eastmoney.com/api/qt/stock/kline/get?'+new URLSearchParams({secid,klt:'101',fqt:'1',lmt:'1000',beg:'0',end:'20500101',fields1:'f1,f2,f3,f4,f5,f6',fields2:'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61'});
 const r=await cached(url),j=JSON.parse(r.text);if(!j.data?.klines?.length)throw Error('日线接口无数据（境外代码或服务受限）');
 const bars=j.data.klines.map(s=>{const a=s.split(',');return {date:a[0],open:num(a[1]),close:num(a[2]),high:num(a[3]),low:num(a[4]),volume:num(a[5]),amount:num(a[6])};}).filter(b=>b.close>0&&b.open>0&&b.high>0&&b.low>0&&b.volume!==null&&b.volume>=0).sort((a,b)=>a.date.localeCompare(b.date));
 return {bars:[...new Map(bars.map(b=>[b.date,b])).values()].slice(-1000),name:j.data.name,source:r};
}
export async function getQuote(symbol){
 const code=symbol.startsWith('US:')?'us'+symbol.slice(3):symbol.toLowerCase(),url='https://qt.gtimg.cn/q='+encodeURIComponent(code),r=await cached(url,{ttl:60000,encoding:'gb18030'}),a=r.text.split('"')[1]?.split('~');
 if(!a||a.length<10||!num(a[3]))throw Error('报价不可用');const domestic=/^(SH|SZ|BJ)/.test(symbol);
 return {quote:{name:a[1],price:num(a[3]),previousClose:num(a[4]),open:num(a[5]),changePct:num(a[32]),high:num(a[33]),low:num(a[34]),volume:num(a[6]),volumeUnit:domestic?'手':'股',amount:num(a[37])===null?null:num(a[37])*(domestic?10000:1),turnoverPct:num(a[38]),timestamp:a[30]||null,marketCap:num(a[45])!==null?num(a[45])*1e8:null,peProvider:num(a[39]),pbProvider:domestic?num(a[46]):null,currency:domestic?'CNY':symbol.startsWith('HK')?'HKD':'USD',stale:r.stale,source:'腾讯行情；非交易所直连，可能延迟',orderBook:domestic?{bids:Array.from({length:5},(_,i)=>({price:num(a[9+i*2]),volume:num(a[10+i*2])})),asks:Array.from({length:5},(_,i)=>({price:num(a[19+i*2]),volume:num(a[20+i*2])}))}:null},source:r};
}
async function announcements(symbol){
 if(!/^(SH|SZ|BJ)/.test(symbol))throw Error('境外公告暂需手动补充');const url='https://np-anotice-stock.eastmoney.com/api/security/ann?'+new URLSearchParams({sr:'-1',page_size:'8',page_index:'1',ann_type:'A',stock_list:symbol.slice(2),f_node:'0',s_node:'0'}),r=await cached(url,{ttl:1800000}),j=JSON.parse(r.text);
 if(!Array.isArray(j.data?.list))throw Error('公告列表不可用');return {rows:j.data.list.map(x=>({title:x.title,date:x.notice_date?.slice(0,10),url:`https://data.eastmoney.com/notices/detail/${symbol.slice(2)}/${x.art_code}.html`,scope:'仅公告标题，未下载全文，不据此确认事件细节'})),source:r};
}
async function macroReport(name){const url='https://datacenter-web.eastmoney.com/api/data/v1/get?'+new URLSearchParams({reportName:name,columns:'ALL',pageSize:'4',sortColumns:'REPORT_DATE',sortTypes:'-1'}),r=await cached(url,{ttl:21600000}),j=JSON.parse(r.text);if(!j.result?.data?.length)throw Error('宏观数据暂不可用');return {rows:j.result.data,source:r};}
export async function collect(input,{research=false,signal}={}){
 const symbol=normalizeSymbol(input),domestic=/^(SH|SZ|BJ)/.test(symbol),code=domestic?symbol.slice(2)+'.'+symbol.slice(0,2):null;
 let basic=null;if(domestic){try{basic=await extraReport('RPT_F10_ORG_BASICINFO',`(SECUCODE="${code}")`,'',1);}catch{}}
 const tasks={quote:()=>getQuote(symbol),prices:()=>getBars(symbol),announcements:()=>announcements(symbol),macroCPI:()=>macroReport('RPT_ECONOMY_CPI'),macroGDP:()=>macroReport('RPT_ECONOMY_GDP')};
 if(domestic){const orgType=basic?.rows[0]?.ORG_TYPE||'',prefix=/银行/.test(orgType)?'B':/保险/.test(orgType)?'I':/证券/.test(orgType)?'S':'G';tasks.income=()=>report(`RPT_F10_FINANCE_${prefix}INCOME`,code);tasks.balance=()=>report(`RPT_F10_FINANCE_${prefix}BALANCE`,code);tasks.cash=()=>report(`RPT_F10_FINANCE_${prefix}CASHFLOW`,code);tasks.summary=()=>report('RPT_DMSK_FN_INCOME',code);if(basic)tasks.profile=async()=>basic;tasks.holders=()=>extraReport('RPT_F10_EH_HOLDERS',`(SECUCODE="${code}")`,'END_DATE');tasks.pledges=()=>extraReport('RPT_CSDC_LIST',`(SECURITY_CODE="${symbol.slice(2)}")`,'TRADE_DATE',4);tasks.dividends=()=>extraReport('RPT_SHAREBONUS_DET',`(SECURITY_CODE="${symbol.slice(2)}")`,'EX_DIVIDEND_DATE');}
 else tasks.foreign=async()=>{const {collectForeign}=await import('./foreign.mjs');return collectForeign(symbol);};
 if(domestic&&research)tasks.capitalFlow=async()=>{const {capitalFlow}=await import('./market.mjs');const r=await capitalFlow(symbol);return {...r,sources:r.sources.map(s=>({...s,kind:'capital_flow_'+s.kind}))};};
 const entries=Object.entries(tasks),results=await Promise.allSettled(entries.map(([,fn])=>fn())),raw={},sources=[],warnings=[];
 results.forEach((r,i)=>{const key=entries[i][0];if(r.status==='fulfilled'){raw[key]=r.value;const ss=r.value.sources||[r.value.source];for(const s of ss){sources.push({id:'S'+(sources.length+1),kind:s.kind||key,url:s.url,fetchedAt:s.fetchedAt,fromCache:!!s.cache,stale:!!s.stale});if(s.stale)warnings.push(`${key} 使用过期缓存，刷新失败`);}warnings.push(...(r.value.warnings||[]));}else warnings.push(`${key}: ${r.reason.message}`);});
 if(!raw.quote&&!raw.prices)throw Error('无法获取该证券的报价或日线，请检查代码和网络');
 const quote=raw.quote?.quote||{name:raw.prices?.name,price:raw.prices?.bars.at(-1)?.close,currency:domestic?'CNY':symbol.startsWith('HK')?'HKD':'USD',stale:true,source:'仅有前复权日线，不能替代当前未复权报价'},bars=raw.prices?.bars||[];
 if(quote.timestamp&&/^\d{14}$/.test(quote.timestamp)){const ts=`${quote.timestamp.slice(0,4)}-${quote.timestamp.slice(4,6)}-${quote.timestamp.slice(6,8)}T${quote.timestamp.slice(8,10)}:${quote.timestamp.slice(10,12)}:${quote.timestamp.slice(12,14)}+08:00`;quote.stale=quote.stale||(Date.now()-Date.parse(ts)>5*86400000);}
 else if(quote.timestamp&&/^\d{4}[-/]\d{2}[-/]\d{2}/.test(quote.timestamp)){const day=quote.timestamp.slice(0,10).replaceAll('/','-');quote.stale=quote.stale||(Date.now()-Date.parse(day+'T12:00:00Z')>5*86400000);}
 else quote.stale=true;
 if(raw.income)raw.income.rows=raw.income.rows.map(r=>({...r,TOTAL_OPERATE_INCOME:r.TOTAL_OPERATE_INCOME??r.OPERATE_INCOME,TOTAL_OPERATE_INCOME_YOY:r.TOTAL_OPERATE_INCOME_YOY??r.OPERATE_INCOME_YOY}));
 const f=raw.foreign?raw.foreign.compute(quote):fundamentals(raw.income?.rows,raw.balance?.rows,raw.cash?.rows,raw.summary?.rows,quote),tech=technical(bars);
 if(domestic&&f.available){f.industry=f.industry||basic?.rows[0]?.EM2016;const cutoff=new Date(Date.now()-365*86400000).toISOString().slice(0,10),today=now().slice(0,10);const payments=(raw.dividends?.rows||[]).filter(r=>r.ASSIGN_PROGRESS==='实施分配'&&r.EX_DIVIDEND_DATE?.slice(0,10)>cutoff&&r.EX_DIVIDEND_DATE.slice(0,10)<=today&&num(r.PRETAX_BONUS_RMB)!==null);if(payments.length){const unique=[...new Map(payments.map(r=>[r.EX_DIVIDEND_DATE+'|'+r.REPORT_DATE+'|'+r.PRETAX_BONUS_RMB,r])).values()];f.dividendYield=quote.currency==='CNY'?unique.reduce((s,r)=>s+Number(r.PRETAX_BONUS_RMB)/10,0)/quote.price*100:null;f.notes.push('股息率=近365日已实施且除息的税前每股现金分红/当前报价，可能包含特别分红，不代表未来股息。');f.missing=f.missing.filter(x=>!x.includes('股息率'));}}
 const assessment=assess(f,tech,quote);
 let peers=[];const industry=raw.summary?.rows[0]?.INDUSTRY_CODE,reportDate=raw.summary?.rows[0]?.REPORT_DATE;
 if(industry&&reportDate){try{const r=await report('RPT_DMSK_FN_INCOME',code,100,`(INDUSTRY_CODE="${industry}")(REPORT_DATE='${reportDate.slice(0,10)}')`);peers=r.rows.filter(x=>x.SECURITY_CODE!==symbol.slice(2)).sort((a,b)=>b.TOTAL_OPERATE_INCOME-a.TOTAL_OPERATE_INCOME).slice(0,8).map(x=>({code:x.SECURITY_CODE,name:x.SECURITY_NAME_ABBR,reportDate:x.REPORT_DATE.slice(0,10),revenue:x.TOTAL_OPERATE_INCOME,revenueGrowth:x.TOI_RATIO,netMargin:x.TOTAL_OPERATE_INCOME?x.PARENT_NETPROFIT/x.TOTAL_OPERATE_INCOME*100:null,profitGrowth:x.PARENT_NETPROFIT_RATIO}));sources.push({id:'S'+(sources.length+1),kind:'peers',url:r.source.url,fetchedAt:r.source.fetchedAt,stale:!!r.source.stale});}catch(e){warnings.push('同业对比：'+e.message);}}
 let webResearch=[],searchCalls=0;
 if(research&&process.env.MINIMAX_WEB_SEARCH!=='false'){const {researchWeb:search}=await import('./search.mjs');const r=await search(quote.name,symbol,{signal});searchCalls=r.calls;warnings.push(...r.warnings);webResearch=r.items.map(item=>{const id='S'+(sources.length+1);sources.push({id,kind:'web_search_snippet',url:item.url,title:item.title,publishedAt:item.publishedAt,fetchedAt:item.fetchedAt,scope:item.scope});return {...item,sourceId:id};});}
 if(!domestic)warnings.push('境外财报采用本地财年和原币种；缺少汇率或 ADR 对应关系时不跨币种推算 PE/PB。境外同业与公告全文待补充核验。');
 return {symbol,name:quote.name,collectedAt:now(),quote,fundamentals:f,technical:tech,assessment,peers,announcements:raw.announcements?.rows||[],macro:{cpi:raw.macroCPI?.rows||[],gdp:raw.macroGDP?.rows||[],scope:'中国宏观指标；境外标的不可直接套用，利率/汇率/政策需另行核验'},sources,warnings,webResearch,searchCalls,capitalFlow:raw.capitalFlow||null,profile:raw.foreign?.profile||raw.profile?.rows[0]||null,ownership:raw.holders?.rows?.filter(r=>r.END_DATE===raw.holders.rows[0]?.END_DATE)||[],pledges:raw.pledges?.rows||[],dividends:raw.dividends?.rows||[],statements:raw.foreign?.statements||{income:raw.income?.rows||[],balance:raw.balance?.rows||[],cash:raw.cash?.rows||[]}};
}
