import{mkdir,readFile,writeFile,rename}from'node:fs/promises';
import{cached}from'./data.mjs';
import{num}from'./analytics.mjs';
import{INDICES}from'./instruments.mjs';
const FILTERS={CN:'m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048',HK:'m:128+t:3,m:128+t:4,m:128+t:1',US:'m:105,m:106,m:107',industry:'m:90+t:2+f:!50',concept:'m:90+t:3+f:!50'};
const FIELDS='f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f62,f100,f115,f124,f128,f140,f141,f184';
const pending=new Map(),statuses=new Map();
const validMarket=market=>{if(!['CN','HK','US'].includes(market))throw Error('市场须为 CN、HK 或 US');return market;};
const folder=new URL('../data/panorama/',import.meta.url);
async function readSnapshot(market){try{return JSON.parse(await readFile(new URL(market+'.json',folder),'utf8'));}catch{return null;}}
async function writeSnapshot(market,value){await mkdir(folder,{recursive:true});const target=new URL(market+'.json',folder),temp=new URL(market+'.tmp',folder);await writeFile(temp,JSON.stringify(value));await rename(temp,target);}
export async function fetchListPage(scope,page=1){
 if(!FILTERS[scope]||!Number.isInteger(page)||page<1||page>400)throw Error('列表范围或页码无效');
 const params=new URLSearchParams({pn:String(page),pz:'100',po:'1',np:'1',fltt:'2',invt:'2',fid:'f12',fs:FILTERS[scope],fields:FIELDS});let last;
 for(const host of ['https://push2delay.eastmoney.com','https://push2his.eastmoney.com']){try{const r=await cached(host+'/api/qt/clist/get?'+params,{ttl:60000}),j=JSON.parse(r.text);if(!Array.isArray(j.data?.diff)||!Number.isFinite(j.data.total))throw Error('列表接口返回格式无效');if(!j.data.diff.length&&j.data.total>0&&page===1)throw Error('列表为空');return {rows:j.data.diff,total:j.data.total,source:{url:r.url,fetchedAt:r.fetchedAt,stale:!!r.stale}};}catch(e){last=e;}}throw last;
}
export function normalizeRow(row,market){
 const code=String(row.f12||''),m=Number(row.f13),symbol=market==='CN'?(m===1?'SH':/^(?:[48]|92)/.test(code)?'BJ':'SZ')+code:market==='HK'?'HK'+code.padStart(5,'0'):'US:'+code;
 return {symbol,secid:m+'.'+code,code,name:String(row.f14||code),market,currency:market==='CN'?'CNY':market==='US'?'USD':Number(code)>=80000&&Number(code)<=89999?'CNY':'HKD',industry:row.f100&&row.f100!=='-'?String(row.f100):'行业未分类',price:num(row.f2),changePct:num(row.f3),change:num(row.f4),volume:num(row.f5),amount:num(row.f6),amplitude:num(row.f7),turnover:num(row.f8),peDynamic:num(row.f9),volumeRatio:num(row.f10),high:num(row.f15),low:num(row.f16),open:num(row.f17),previousClose:num(row.f18),marketCap:num(row.f20),floatCap:num(row.f21),pb:num(row.f23),return60:num(row.f24),returnYtd:num(row.f25),peTTM:num(row.f115),mainNet:market==='CN'?num(row.f62):null,mainRatio:market==='CN'?num(row.f184):null,quoteTime:num(row.f124)>0?new Date(Number(row.f124)*1000).toISOString():null};
}
export function histogram(rows,key,edges){
 const bins=Array.from({length:edges.length+1},(_,i)=>({low:i?edges[i-1]:null,high:i<edges.length?edges[i]:null,count:0}));let missing=0;
 for(const r of rows){const v=num(r[key]);if(v===null){missing++;continue;}let i=edges.findIndex(x=>v<x);if(i<0)i=edges.length;bins[i].count++;}return {bins,missing};
}
export function summarize(rows,market){
 const baseCurrency=market==='CN'?'CNY':market==='HK'?'HKD':'USD',sameCurrency=rows.filter(r=>r.currency===baseCurrency),active=rows.filter(r=>r.price>0&&r.changePct!==null&&r.amount>0),groups=new Map();
 for(const r of sameCurrency){const key=r.industry,g=groups.get(key)||{name:key,count:0,amount:0,amountCount:0,marketCap:0,mainNet:0,flowCount:0,up:0,down:0,returns:[]};g.count++;if(r.amount!==null){g.amount+=r.amount;g.amountCount++;}if(r.marketCap!==null)g.marketCap+=r.marketCap;if(r.mainNet!==null){g.mainNet+=r.mainNet;g.flowCount++;}if(r.amount>0&&r.changePct!==null){g.returns.push(r.changePct);if(r.changePct>0)g.up++;if(r.changePct<0)g.down++;}groups.set(key,g);}
 const industries=[...groups.values()].map(({returns,...g})=>({...g,averageChange:returns.length?returns.reduce((s,v)=>s+v,0)/returns.length:null,returnCount:returns.length})).sort((a,b)=>b.amount-a.amount);
 const values=key=>sameCurrency.map(r=>r[key]).filter(v=>v!==null&&Number.isFinite(v)),sum=key=>{const a=values(key);return a.length?a.reduce((s,v)=>s+v,0):null;},median=a=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y);return b.length%2?b[(b.length-1)/2]:(b[b.length/2-1]+b[b.length/2])/2;};
 return {total:rows.length,active:active.length,up:active.filter(r=>r.changePct>0).length,down:active.filter(r=>r.changePct<0).length,flat:active.filter(r=>r.changePct===0).length,inactive:rows.length-active.length,baseCurrency,amount:sum('amount'),amountCount:values('amount').length,mainNet:market==='CN'?sum('mainNet'):null,flowCount:market==='CN'?values('mainNet').length:0,medianPE:median(sameCurrency.map(r=>r.peTTM).filter(v=>v>0)),medianPB:median(sameCurrency.map(r=>r.pb).filter(v=>v>0)),excludedCurrency:rows.length-sameCurrency.length,industries,changeHistogram:histogram(active,'changePct',[-7,-5,-3,-1,0,1,3,5,7]),peHistogram:histogram(sameCurrency.filter(r=>r.peTTM>0),'peTTM',[10,20,30,50,100]),pbHistogram:histogram(sameCurrency.filter(r=>r.pb>0),'pb',[1,2,3,5,10]),negativePE:sameCurrency.filter(r=>r.peTTM!==null&&r.peTTM<=0).length,notes:['广度仅统计有成交额且有有效涨跌幅的证券；无成交/缺失不当作平盘。','行业涨跌为样本内等权平均，不是官方行业指数；热力面积为同币种成交额。','成交额、资金流分币种统计；港股人民币柜台不并入港币总额，上市柜台数不等于公司数。','资金为数据商主力分类，非机构身份或市场新增现金；港美股不提供同口径主力资金统计。','PE/PB 为供应商口径，正值样本计算中位数，亏损或非正值单列；不是投资评分。']};
}
async function sync(market){
 const status={market,status:'running',startedAt:new Date().toISOString(),loaded:0,total:null,pages:0,error:null};statuses.set(market,status);const started=Date.now(),sources=[],raw=[];
 try{const first=await fetchListPage(market);if(!first.rows.length)throw Error('数据源没有返回股票列表');const size=first.rows.length,total=first.total,pages=Math.ceil(total/size);if(pages>400)throw Error('数据量超过本地同步上限');raw.push(...first.rows);sources.push(first.source);Object.assign(status,{loaded:raw.length,total,pages:1,totalPages:pages});
  for(let page=2;page<=pages;page+=4){const results=await Promise.all(Array.from({length:Math.min(4,pages-page+1)},(_,i)=>fetchListPage(market,page+i)));for(const r of results){if(!r.rows.length)throw Error('中间分页为空，未覆盖旧快照');raw.push(...r.rows);sources.push(r.source);status.pages++;}status.loaded=raw.length;}
  const rows=[...new Map(raw.map(r=>{const item=normalizeRow(r,market);return [item.secid,item];})).values()],complete=rows.length===total,warnings=[];if(!complete)warnings.push(`分页期间列表可能变化：源总数 ${total}，去重取得 ${rows.length}；请刷新重试确认完整性`);if(sources.some(s=>s.stale))warnings.push('部分页面使用过期缓存');const times=rows.map(r=>r.quoteTime).filter(Boolean).sort();
  const snapshot={market,fetchedAt:new Date().toISOString(),durationMs:Date.now()-started,expectedTotal:total,count:rows.length,complete,stale:sources.some(s=>s.stale),quoteTimeMin:times[0]||null,quoteTimeMax:times.at(-1)||null,rows,summary:summarize(rows,market),sources,warnings};await writeSnapshot(market,snapshot);Object.assign(status,{status:'completed',loaded:rows.length,complete,finishedAt:snapshot.fetchedAt});
 }catch(e){Object.assign(status,{status:'failed',error:String(e.message).slice(0,500),finishedAt:new Date().toISOString()});}finally{pending.delete(market);}
}
export function startSync(market){validMarket(market);if(pending.has(market))return statuses.get(market);const work=sync(market);pending.set(market,work);return statuses.get(market);}
export async function syncStatus(market){validMarket(market);const status=statuses.get(market);if(status)return status;const snapshot=await readSnapshot(market);return {market,status:snapshot?'completed':'empty',loaded:snapshot?.count||0,total:snapshot?.expectedTotal||null,finishedAt:snapshot?.fetchedAt||null,complete:snapshot?.complete||false};}
export async function getSnapshot(market){validMarket(market);const data=await readSnapshot(market);return data?{...data,sync:await syncStatus(market)}:{market,rows:[],count:0,summary:summarize([],market),sync:await syncStatus(market),complete:false,warnings:['尚未同步此市场，请同步完整股票池']};}
export async function indexQuotes(){
 const url='https://push2.eastmoney.com/api/qt/ulist.np/get?'+new URLSearchParams({secids:INDICES.map(i=>i.secid).join(','),fltt:'2',fields:'f2,f3,f4,f5,f6,f12,f13,f14,f15,f16,f17,f18,f124'}),r=await cached(url,{ttl:60000}),j=JSON.parse(r.text);if(!Array.isArray(j.data?.diff))throw Error('主要指数接口暂不可用');
 return {fetchedAt:r.fetchedAt,stale:!!r.stale,source:url,indices:INDICES.map(i=>{const d=j.data.diff.find(x=>x.f13+'.'+x.f12===i.secid);return {...i,available:!!d,price:num(d?.f2),changePct:num(d?.f3),change:num(d?.f4),volume:num(d?.f5),amount:num(d?.f6)>0?num(d.f6):null,high:num(d?.f15),low:num(d?.f16),open:num(d?.f17),previousClose:num(d?.f18),quoteTime:num(d?.f124)>0?new Date(Number(d.f124)*1000).toISOString():null};})};
}
async function loadBoardQuotes(type='industry'){
 if(!['industry','concept'].includes(type))throw Error('板块类型无效');const first=await fetchListPage(type),pages=Math.ceil(first.total/Math.max(first.rows.length,1)),results=await Promise.all(Array.from({length:Math.max(0,pages-1)},(_,i)=>fetchListPage(type,i+2))),rows=[first,...results].flatMap(r=>r.rows),sources=[first,...results].map(r=>r.source);
 return {type,fetchedAt:new Date().toISOString(),expectedTotal:first.total,complete:rows.length===first.total,sources,rows:rows.map(r=>({symbol:'BOARD:'+r.f12,name:r.f14,price:num(r.f2),changePct:num(r.f3),amount:num(r.f6),turnover:num(r.f8),mainNet:num(r.f62),mainRatio:num(r.f184),leader:r.f128&&r.f128!=='-'?r.f128:null,leaderSymbol:r.f140&&r.f140!=='-'?(Number(r.f141)===1?'SH':'SZ')+r.f140:null,quoteTime:num(r.f124)>0?new Date(Number(r.f124)*1000).toISOString():null})),note:'数据商行业/概念板块分类可能交叉与重叠，成交额及资金不能跨板块直接加总；与按股票所属行业归组的热力图口径不同。'};
}
const boardPending=new Map();
export async function boardQuotes(type='industry'){
 if(!['industry','concept'].includes(type))throw Error('板块类型无效');if(boardPending.has(type))return boardPending.get(type);const file=new URL('boards-'+type+'.json',folder);const work=(async()=>{try{const old=JSON.parse(await readFile(file,'utf8'));if(Date.now()-Date.parse(old.fetchedAt)<300000)return old;}catch{}let value;try{value=await loadBoardQuotes(type);}catch(e){const {derivedBoards}=await import('./board-fallback.mjs');value=await derivedBoards(type,e.message);}await mkdir(folder,{recursive:true});await writeFile(file,JSON.stringify(value));return value;})();boardPending.set(type,work);try{return await work;}finally{boardPending.delete(type);}
}
