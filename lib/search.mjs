import{createHash}from'node:crypto';
import{mkdir,readFile,writeFile}from'node:fs/promises';
const endpoint='https://api.minimax.cn/v1/coding_plan/search';
async function search(q,signal){
 await mkdir('data/search',{recursive:true});const file=`data/search/${createHash('sha256').update(q).digest('hex')}.json`;
 try{const old=JSON.parse(await readFile(file,'utf8'));if(Date.now()-Date.parse(old.fetchedAt)<21600000)return {...old,cache:true};}catch{}
 const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.MINIMAX_API_KEY},body:JSON.stringify({q}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(35000)]):AbortSignal.timeout(35000)});
 const j=await r.json();if(!r.ok||j.base_resp?.status_code||!Array.isArray(j.organic))throw Error(j.base_resp?.status_msg||`搜索接口 HTTP ${r.status}`);
 const result={query:q,fetchedAt:new Date().toISOString(),items:j.organic.slice(0,8).filter(x=>{try{return ['http:','https:'].includes(new URL(x.link).protocol);}catch{return false;}}).map(x=>({title:String(x.title||'').slice(0,300),url:x.link,snippet:String(x.snippet||'').slice(0,1800),publishedAt:x.date||null,scope:'搜索摘要，未阅读原文；发布日期由搜索服务提供，需核验'}))};await writeFile(file,JSON.stringify(result));return result;
}
export async function researchWeb(name,symbol,{signal}={}){
 if(!process.env.MINIMAX_API_KEY)return {items:[],warnings:['联网检索未配置：可单独设置 MINIMAX_API_KEY；模型研究继续使用已采集证据。'],calls:0};
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'}),us=symbol.startsWith('US:'),queries=us?[`${symbol.slice(3)} ${name} earnings annual report competitive risks ${today}`,`${symbol.slice(3)} management governance litigation SEC filings ${today}`,`${symbol.slice(3)} industry monetary policy interest rates outlook ${today}`]:[`${name} ${symbol} 财报 竞争格局 市占率 ${today}`,`${name} 管理层 股权质押 关联交易 诉讼 ESG ${today}`,`${name} 所属行业 政策 利率 汇率 风险 ${today}`];
 const results=await Promise.allSettled(queries.map(q=>search(q,signal))),items=[],warnings=[];let calls=0;for(const r of results){if(r.status==='fulfilled'){if(!r.value.cache)calls++;items.push(...r.value.items.map(x=>({...x,fetchedAt:r.value.fetchedAt,query:r.value.query})));}else warnings.push('联网检索不可用：'+r.reason.message);}return {items:[...new Map(items.map(x=>[x.url,x])).values()],warnings,calls};
}
