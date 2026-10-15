import assert from'node:assert/strict';
import{marketBars,capitalFlow,PERIODS}from'../lib/market.mjs';
for(const period of Object.keys(PERIODS)){
 try{const d=await marketBars('600519',period,'1');assert.ok(d.bars.length>0);assert.ok(d.bars.every(b=>b.close>0&&b.volume>=0));assert.ok(Number.isFinite(d.bars.at(-1).macd));console.log(PERIODS[period],d.bars.length,d.bars.at(-1).time);}catch(err){console.log('FAIL',PERIODS[period],err.message);process.exitCode=1;}
}
for(const symbol of ['00700.HK','AAPL','IBM']){try{for(const period of ['intraday','five','101','102','103']){const d=await marketBars(symbol,period);assert.ok(d.bars.length);console.log(symbol,d.secid,d.label,d.bars.length);}}catch(err){console.log('FAIL',symbol,err.message);process.exitCode=1;}}
const f=await capitalFlow('600519');assert.ok(f.available);assert.ok(f.daily.length>0);assert.ok(f.intraday.length>0);assert.ok(f.snapshot.mainBuy>0);assert.ok(f.snapshot.mainSell>0);assert.ok(Math.abs(f.snapshot.mainBuy-f.snapshot.mainSell-f.snapshot.mainNet)<100);assert.equal((await capitalFlow('AAPL')).available,false);console.log('Fund flow verified: gross buy - gross sell = net; foreign unavailable correctly');
