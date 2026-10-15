// Deterministic price-only research signals. This is separate from the LLM committee.
const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
const sign=x=>x>0?1:x<0?-1:0;
export function signalAt(bars,t){
 if(t<200||t>=bars.length)throw Error('At least 201 historical bars are required');
 const closes=bars.slice(t-200,t+1).map(b=>b.close),last=closes.at(-1),changes=closes.slice(-15).slice(1).map((c,i)=>c-closes.slice(-15)[i]);
 const gain=changes.reduce((s,x)=>s+Math.max(x,0),0),loss=changes.reduce((s,x)=>s+Math.max(-x,0),0),rsi=loss===0?(gain===0?50:100):100-100/(1+gain/loss);
 const returns=closes.slice(-21).slice(1).map((c,i)=>Math.log(c/closes.slice(-21)[i])),mu=avg(returns),vol=Math.sqrt(avg(returns.map(x=>(x-mu)**2))*252);
 const agents={trend:sign(last/avg(closes.slice(-50))-1),momentum:sign(last/closes.at(-21)-1),reversal:rsi<45?1:rsi>55?-1:0};
 const vote=Object.values(agents).reduce((s,x)=>s+x,0),direction=vote>=0?1:-1;
 return {agents,direction,score:vote/3,rsi,annualizedVolatility:vol,riskGate:vol>.6||last<avg(closes.slice(-200)),asOf:bars[t].date||bars[t].time,note:'规则方向信号；未校准为概率，与八角色 LLM 报告独立。'};
}
export function prediction(signals,method){
 if(method==='always_up')return 1;
 if(method==='trend')return signals.agents.trend>=0?1:-1;
 const names=Object.keys(signals.agents).filter(k=>method!=='without_'+k);
 return names.reduce((s,k)=>s+signals.agents[k],0)>=0?1:-1;
}
