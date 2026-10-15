import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sma,rsi,technical,ttm,fundamentals,assess,dcf,backtest} from '../lib/analytics.mjs';
import {normalizeSymbol} from '../lib/data.mjs';
import {fiscalTTM} from '../lib/foreign.mjs';
test('symbol normalization is idempotent across three markets and rejects injection',()=>{
 for(const [input,expected]of [['600519','SH600519'],['000001','SZ000001'],['00700.HK','HK00700'],['AAPL','US:AAPL'],['US:BRK_B','US:BRK_B']]){assert.equal(normalizeSymbol(input),expected);assert.equal(normalizeSymbol(expected),expected);}assert.throws(()=>normalizeSymbol('600519");DROP TABLE'));
});
test('TTM uses cumulative annual bridge and leaves missing periods unknown',()=>{
 const rows=[{REPORT_DATE:'2026-06-30',x:70},{REPORT_DATE:'2025-12-31',x:110},{REPORT_DATE:'2025-06-30',x:50}];assert.equal(ttm(rows,'x'),130);assert.equal(ttm(rows.slice(0,2),'x'),null);assert.equal(ttm([{REPORT_DATE:'2025-12-31',x:0}],'x'),0);
});
test('foreign TTM respects fiscal period labels rather than calendar December',()=>{
 assert.equal(fiscalTTM([{fiscalYear:2026,period:'004',profit:90},{fiscalYear:2025,period:'001',profit:120},{fiscalYear:2025,period:'004',profit:80}],'profit'),130);
});
test('statements align by date, not array position; missing values remain unknown',()=>{
 const income=[{REPORT_DATE:'2026-06-30',PARENT_NETPROFIT:10},{REPORT_DATE:'2025-12-31',TOTAL_OPERATE_INCOME:100,PARENT_NETPROFIT:20,NETPROFIT:20}],balance=[{REPORT_DATE:'2025-12-31',TOTAL_ASSETS:200,TOTAL_LIABILITIES:80,TOTAL_CURRENT_ASSETS:70,TOTAL_CURRENT_LIAB:35,INVENTORY:14}],cash=[{REPORT_DATE:'2025-12-31',NETCASH_OPERATE:30,CONSTRUCT_LONG_ASSET:5}];const f=fundamentals(income,balance,cash,[],{marketCap:400});assert.equal(f.reportDate,'2025-12-31');assert.equal(f.currentRatio,2);assert.equal(f.quickRatio,1.6);assert.equal(f.profitTTM,20);assert.equal(f.peTTM,20);assert.equal(f.roeTTM,null);assert.equal(f.fcfTTM,25);
});
test('RSI and moving averages handle warmup, flat and monotonic series',()=>{
 assert.equal(sma([1,2,3],2)[0],null);assert.equal(sma([1,2,3],2)[2],2.5);assert.equal(rsi(Array(20).fill(10)).at(-1),50);assert.equal(rsi(Array.from({length:20},(_,i)=>i)).at(-1),100);assert.equal(rsi(Array.from({length:20},(_,i)=>20-i)).at(-1),0);
});
test('DCF subtracts debt from enterprise value and rejects invalid terminal assumptions',()=>{
 const r=dcf({fcff:100,netDebt:200,shares:10,growth:0,discount:.1,terminal:0,years:5});assert.ok(Math.abs(r.enterprise-1000)<1e-8);assert.ok(Math.abs(r.perShare-80)<1e-8);assert.throws(()=>dcf({fcff:100,shares:10,discount:.02,terminal:.03}));assert.throws(()=>dcf({fcff:100,shares:0}));
});
test('financial industry never receives generic leverage screening penalty',()=>{
 const a=assess({industry:'银行',available:true,debtRatio:90,roeTTM:12,profitGrowth:5,revenueGrowth:5},{available:true,barCount:250,ma200:10,close:11},{});assert.equal(a.financialIndustry,true);assert.ok(!a.components.some(x=>x.label==='资产负债率'));assert.ok(!a.risks.some(x=>x.includes('高于 70%')));
});
test('backtest signal cannot benefit from same-bar jumps and includes fees',()=>{
 const bars=Array.from({length:250},(_,i)=>({date:String(i),close:i<220?100:200,open:100,high:200,low:100,volume:100}));const r=backtest(bars,{fast:5,slow:20,feeBps:10});assert.ok(r.totalReturnPct<=0);assert.ok(r.benchmarkReturnPct>99);assert.ok(r.trades>=2);assert.equal(r.curve.at(-1).strategy,1+r.totalReturnPct/100);
});
test('technical support excludes the current breakout bar',()=>{
 const bars=Array.from({length:250},(_,i)=>({date:String(i),close:i===249?120:100,open:100,high:i===249?121:101,low:99,volume:100}));const t=technical(bars);assert.equal(t.resistance60,101);assert.equal(t.breakout,true);assert.equal(t.support60,99);assert.ok(t.ma200!==null);
});
