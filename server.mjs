import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { normalizeSymbol,searchStocks,collect } from './lib/data.mjs';
import { modelConfig,testModel,createJob,cancelJob,followUp,markdown,safeError,roles } from './lib/agents.mjs';
import { getJob,listJobs,getSetting,setSetting,recoverJobs } from './lib/store.mjs';
import { dcf,backtest } from './lib/analytics.mjs';
import {marketBars,capitalFlow,marketQuote} from './lib/market.mjs';
import {startSync,syncStatus,getSnapshot,indexQuotes,boardQuotes} from './lib/panorama.mjs';
import {isBenchmark} from './lib/instruments.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),port=Number(process.env.PORT)||8787;
recoverJobs();const limiters=new Map();
function rate(key,max=20){const now=Date.now(),old=limiters.get(key)||[];const arr=old.filter(t=>now-t<60000);if(arr.length>=max)throw Error('操作过于频繁，请稍后重试');arr.push(now);limiters.set(key,arr);}
function json(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(obj));}
async function body(req){let content='';for await(const chunk of req){content+=chunk;if(Buffer.byteLength(content)>180000)throw Error('请求过大');}try{return content?JSON.parse(content):{};}catch{throw Error('无效 JSON');}}
const text=(x,max)=>typeof x==='string'?x.trim().slice(0,max):'';
http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
 const host=req.headers.host;if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(host))return json(res,403,{error:'仅允许本机访问'});
 const url=new URL(req.url,`http://127.0.0.1:${port}`),p=url.pathname;
 try{
  if(req.method==='POST'){
   const origin=req.headers.origin;if(origin&&![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(origin))return json(res,403,{error:'拒绝跨站请求'});
   if(!req.headers['content-type']?.startsWith('application/json')||req.headers['x-stock-client']!=='local')return json(res,403,{error:'请求必须来自本地客户端'});
  }
  if(req.method==='GET'&&p==='/api/health')return json(res,200,{ok:true,version:'1.0.0',model:modelConfig(),roles,storage:'本地 SQLite',time:new Date().toISOString()});
  if(req.method==='GET'&&p==='/api/search')return json(res,200,await searchStocks(text(url.searchParams.get('q'),40)));
  if(req.method==='GET'&&p==='/api/panorama/snapshot')return json(res,200,await getSnapshot(url.searchParams.get('market')||'CN'));
  if(req.method==='GET'&&p==='/api/panorama/status')return json(res,200,await syncStatus(url.searchParams.get('market')||'CN'));
  if(req.method==='GET'&&p==='/api/panorama/indices')return json(res,200,await indexQuotes());
  if(req.method==='GET'&&p==='/api/panorama/boards')return json(res,200,await boardQuotes(url.searchParams.get('type')||'industry'));
  if(req.method==='POST'&&p==='/api/panorama/sync'){rate('panorama-sync',6);const b=await body(req);return json(res,202,startSync(b.market||'CN'));}
  if(req.method==='GET'&&p==='/api/market/bars')return json(res,200,await marketBars(url.searchParams.get('symbol'),url.searchParams.get('period')||'101',url.searchParams.get('adjust')||'1'));
  if(req.method==='GET'&&p==='/api/market/quote')return json(res,200,await marketQuote(url.searchParams.get('symbol')));
  if(req.method==='GET'&&p==='/api/market/flow')return json(res,200,await capitalFlow(url.searchParams.get('symbol')));
  if(req.method==='GET'&&p==='/api/jobs')return json(res,200,listJobs());
  if(req.method==='GET'&&p==='/api/workspace')return json(res,200,{watchlist:getSetting('watchlist',[{symbol:'SH600519',name:'贵州茅台'},{symbol:'SZ300750',name:'宁德时代'},{symbol:'SH600036',name:'招商银行'}]),portfolio:getSetting('portfolio',[])});
  if(req.method==='POST'&&p==='/api/workspace'){
   const b=await body(req);if(b.watchlist){if(!Array.isArray(b.watchlist)||b.watchlist.length>60)throw Error('自选最多 60 项');setSetting('watchlist',b.watchlist.map(x=>({symbol:normalizeSymbol(x.symbol),name:text(x.name,40)})));}
   if(b.portfolio){if(!Array.isArray(b.portfolio)||b.portfolio.length>100)throw Error('持仓最多 100 项');setSetting('portfolio',b.portfolio.map(x=>{if(!Number.isFinite(x.quantity)||x.quantity<=0||!Number.isFinite(x.cost)||x.cost<=0)throw Error('数量、成本须为正数');return {symbol:normalizeSymbol(x.symbol),quantity:x.quantity,cost:x.cost};}));}return json(res,200,{ok:true});
  }
  if(req.method==='POST'&&p==='/api/model/test'){rate('model',3);return json(res,200,await testModel());}
  if(req.method==='POST'&&p==='/api/jobs'){
   rate('jobs',6);const b=await body(req),symbol=normalizeSymbol(b.symbol),mode=b.mode==='data'?'data':'deep';if(isBenchmark(symbol))throw Error('指数与板块请在行情页查看技术指标，企业三大报表研究仅适用于股票');return json(res,202,createJob({symbol,mode,style:text(b.style,200)||'中长期基本面、风险适中',notes:text(b.notes,12000)}));
  }
  const m=p.match(/^\/api\/jobs\/([a-f0-9-]{36})(?:\/(cancel|export|chat))?$/);
  if(m){const j=getJob(m[1]);if(!j)return json(res,404,{error:'未找到报告'});
   if(req.method==='GET'&&!m[2])return json(res,200,j);
   if(req.method==='POST'&&m[2]==='cancel')return json(res,200,cancelJob(j.id));
   if(req.method==='POST'&&m[2]==='chat'){rate('chat',6);if(!['completed','partial','failed'].includes(j.status))throw Error('请等待分析结束后追问');const b=await body(req),q=text(b.question,3000);if(!q)throw Error('请输入问题');return json(res,200,await followUp(j.id,q));}
   if(req.method==='GET'&&m[2]==='export'){const format=url.searchParams.get('format');res.setHeader('Content-Disposition',`attachment; filename="${j.symbol}-${j.id.slice(0,8)}.${format==='json'?'json':'md'}"`);res.writeHead(200,{'Content-Type':format==='json'?'application/json; charset=utf-8':'text/markdown; charset=utf-8'});return res.end(format==='json'?JSON.stringify(j,null,2):markdown(j));}
  }
  if(req.method==='POST'&&p==='/api/screen'){
   rate('screen',3);const b=await body(req);if(!Array.isArray(b.symbols)||!b.symbols.length||b.symbols.length>12)throw Error('每次筛选 1–12 只股票');const symbols=[...new Set(b.symbols.map(normalizeSymbol))],out=[];
   // Small batches protect public data providers; screening never calls the LLM.
   for(let i=0;i<symbols.length;i+=3){await Promise.all(symbols.slice(i,i+3).map(async s=>{try{const d=await collect(s);out.push({symbol:s,name:d.name,quote:d.quote,fundamentals:d.fundamentals,assessment:d.assessment,warnings:d.warnings});}catch(e){out.push({symbol:s,error:safeError(e)});}}));}return json(res,200,out.sort((a,b)=>(b.assessment?.score??-1)-(a.assessment?.score??-1)));
  }
  if(req.method==='POST'&&p==='/api/valuation'){rate('dcf',30);return json(res,200,dcf(await body(req)));}
  if(req.method==='POST'&&p==='/api/backtest'){rate('backtest',6);const b=await body(req),d=await collect(normalizeSymbol(b.symbol));return json(res,200,backtest(d.technical.series||[],{fast:b.fast,slow:b.slow,feeBps:b.feeBps}));}
  if(req.method==='POST'&&p==='/api/portfolio/value'){
   rate('portfolio',4);const holdings=getSetting('portfolio',[]),out=[];for(let i=0;i<holdings.length;i+=3){await Promise.all(holdings.slice(i,i+3).map(async h=>{try{const d=await collect(h.symbol);const valid=d.quote.marketCap!==undefined&&d.quote.source?.startsWith('腾讯');out.push({...h,name:d.name,price:valid?d.quote.price:null,currency:d.quote.currency,marketValue:valid?h.quantity*d.quote.price:null,profit:valid?h.quantity*(d.quote.price-h.cost):null,stale:d.quote.stale,risks:d.assessment.risks});}catch(e){out.push({...h,error:safeError(e)});}}));}return json(res,200,out);
  }
  if(req.method==='GET'&&!p.startsWith('/api/')){
   const files={'/':'index.html','/app.js':'app.js','/market.js':'market.js','/market.css':'market.css','/style.css':'style.css','/panorama.js':'panorama.js','/panorama.css':'panorama.css','/panorama-viz.js':'panorama-viz.js'};if(!files[p])return json(res,404,{error:'页面不存在'});const ext=path.extname(files[p]),mime={'.html':'text/html','.js':'application/javascript','.css':'text/css'};res.writeHead(200,{'Content-Type':mime[ext]+'; charset=utf-8'});return res.end(await readFile(path.join(root,'public',files[p])));
  }
  json(res,404,{error:'接口不存在'});
 }catch(e){json(res,400,{error:safeError(e)});}
}).listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`AstraQuant listening at http://127.0.0.1:${port}`));
