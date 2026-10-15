import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {marketBars} from '../lib/market.mjs';
import {signalAt,prediction} from '../lib/forecast.mjs';
// Universe and parameters are fixed in source before this experiment; no search for winners.
const universe=['IDX:CSI300','IDX:HSI','IDX:SPX','SH600519','SZ000001','SZ300750','HK00700','HK00941','HK09988','US:AAPL','US:MSFT','US:NVDA'];
const methods=['always_up','train_majority','persistence','trend','ensemble','without_trend','without_momentum','without_reversal'];
const horizons=[1,5,20],out='experiments/results';await mkdir(out,{recursive:true});await mkdir('data/experiments',{recursive:true});
const assets=[],errors=[];
for(const symbol of universe){
 try{
  const raw=await marketBars(symbol,'101','1');
  if(raw.stale)throw Error('Stale source cache rejected');
  // Conservatively exclude today's bar in every market, including possibly unfinished sessions.
  const today=new Date().toISOString().slice(0,10),bars=raw.bars.filter(b=>b.open>0&&b.close>0&&b.time.slice(0,10)<today).sort((a,b)=>a.time.localeCompare(b.time));
  if(bars.length<700)throw Error('Fewer than 700 valid daily bars');
  const privateText=JSON.stringify(bars);await writeFile('data/experiments/'+symbol.replaceAll(':','_')+'.json',privateText);
  const split=Math.max(300,Math.floor(bars.length*.6)),trainUp=bars.slice(1,split).filter((b,i)=>b.close>bars[i].close).length/(split-1),signals=new Map();
  for(let t=split;t<bars.length-1;t++)signals.set(t,signalAt(bars,t));
  const tests=[];
  for(const horizon of horizons){
   const records=[];
   // Targets do not overlap within an asset/horizon. +1 execution uses next open.
   for(let t=split;t+horizon+1<bars.length;t+=horizon){
    const s=signals.get(t),ret=bars[t+horizon].close/bars[t].close-1,tradeReturn=bars[t+horizon+1].open/bars[t+1].open-1;
    const guesses=Object.fromEntries(methods.map(method=>[method,method==='train_majority'?(trainUp>=.5?1:-1):method==='persistence'?(bars[t].close>=bars[t-1].close?1:-1):prediction(s,method)]));
    records.push({date:bars[t].time,targetDate:bars[t+horizon].time,actual:Math.sign(ret),tradeReturn,guesses,riskGate:s.riskGate});
   }
   tests.push({horizon,from:records[0]?.date,to:records.at(-1)?.targetDate,metrics:methods.map(method=>directionMetric(records,method)),trading:[0,10,30].flatMap(feeBps=>['always_up','trend','ensemble','ensemble_risk'].map(method=>tradeMetric(records,method,feeBps,horizon))),records});
  }
  assets.push({symbol,name:raw.name,bars:bars.length,trainFrom:bars[0].time,trainTo:bars[split-1].time,testFrom:bars[split].time,testTo:bars.at(-1).time,trainUp,source:raw.source.url,fetchedAt:raw.fetchedAt,sha256:createHash('sha256').update(privateText).digest('hex'),adjust:raw.adjust,tests});
  console.log(symbol,bars.length,assets.at(-1).testFrom,assets.at(-1).testTo);
 }catch(e){errors.push({symbol,error:e.message});console.log('FAILED',symbol,e.message);}
}
if(assets.length<6)throw Error('At least six assets must load; incomplete experiment not published');
const aggregates=horizons.map(horizon=>({horizon,methods:methods.map(method=>aggregate(assets.flatMap(a=>a.tests.find(t=>t.horizon===horizon).records),method))}));
const results={generatedAt:new Date().toISOString(),protocol:'Fixed 12-asset convenience universe; first 60% for baseline sign, final 40% evaluation; untrained fixed rules; non-overlapping horizon targets; next-open long/cash execution; no point-in-time fundamentals or LLM forecasts.',universe,errors,aggregates,assets:assets.map(a=>({...a,tests:a.tests.map(({records,...t})=>({...t,trading:t.trading.map(r=>t.horizon===5&&r.feeBps===10&&['always_up','ensemble','ensemble_risk'].includes(r.method)?r:(({curve,...m})=>m)(r))}))}))};
await writeFile(out+'/quant.json',JSON.stringify(results,null,2)+'\n');
await writeFile(out+'/direction.csv','horizon,method,n,accuracy,balanced_accuracy,ci_low,ci_high,paired_gain_vs_up,paired_ci_low,paired_ci_high\n'+aggregates.flatMap(a=>a.methods.map(m=>[a.horizon,m.method,m.n,m.accuracy,m.balancedAccuracy,...m.ci,m.gainVsUp,...m.pairedCI].join(','))).join('\n')+'\n');
// Only aggregated results are public. Vendor OHLC payloads remain under ignored data/.
console.log(JSON.stringify(aggregates));
function directionMetric(records,method){const r=records.filter(r=>r.actual!==0),n=r.length,up=r.filter(r=>r.actual>0),down=r.filter(r=>r.actual<0),correct=r.filter(r=>r.guesses[method]===r.actual).length;return {method,n,accuracy:correct/n,balancedAccuracy:up.length&&down.length?(up.filter(r=>r.guesses[method]>0).length/up.length+down.filter(r=>r.guesses[method]<0).length/down.length)/2:null};}
function aggregate(records,method){
 const metric=directionMetric(records,method),groups=new Map();
 for(const r of records.filter(r=>r.actual!==0)){const bucket=r.date.slice(0,7);if(!groups.has(bucket))groups.set(bucket,[]);groups.get(bucket).push(r);}
 const blocks=[...groups.values()],scores=[],diffs=[];let seed=19871019;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 for(let b=0;b<1000;b++){let n=0,hit=0,base=0;for(let i=0;i<blocks.length;i++){for(const r of blocks[Math.floor(random()*blocks.length)]){n++;hit+=r.guesses[method]===r.actual?1:0;base+=r.guesses.always_up===r.actual?1:0;}}scores.push(hit/n);diffs.push((hit-base)/n);}
 scores.sort((a,b)=>a-b);diffs.sort((a,b)=>a-b);return {...metric,ci:[scores[24],scores[974]],gainVsUp:metric.accuracy-directionMetric(records,'always_up').accuracy,pairedCI:[diffs[24],diffs[974]],bootstrap:'1000 resamples of calendar-month clusters across assets; approximate, not multiplicity-adjusted'};
}
function tradeMetric(records,method,feeBps,horizon){
 let wealth=1,peak=1,drawdown=0,position=0,turnover=0;const curve=[];
 for(const r of records){const base=method==='ensemble_risk'?'ensemble':method,next=(r.guesses[base]>0&&!(method==='ensemble_risk'&&r.riskGate))?1:0,cost=Math.abs(next-position)*feeBps/10000;turnover+=Math.abs(next-position);wealth*=(1-cost)*(1+next*r.tradeReturn);position=next;peak=Math.max(peak,wealth);drawdown=Math.min(drawdown,wealth/peak-1);curve.push({date:r.targetDate,value:wealth});}
 wealth*=1-position*feeBps/10000;turnover+=position;if(curve.length)curve.at(-1).value=wealth;drawdown=Math.min(drawdown,wealth/peak-1);
 const years=records.length*horizon/252;return {method,feeBps,observations:records.length,totalReturn:wealth-1,cagr:wealth**(1/years)-1,maxDrawdownAtBlockBoundaries:drawdown,turnover,curve};
}
