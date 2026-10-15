import{test}from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{JSDOM}from'jsdom';
import{addIndicators}from'../lib/market.mjs';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8'),script=await readFile(new URL('../public/market.js',import.meta.url),'utf8');
test('market chart renders panels and switches period and indicators without calling LLM',async()=>{
 const dom=new JSDOM(html,{url:'http://127.0.0.1:8787/',runScripts:'outside-only'}),w=dom.window,requests=[],bars=addIndicators(Array.from({length:250},(_,i)=>({time:'2026-01-'+String(i),date:String(i),open:100+i,close:100.5+i,high:101+i,low:99+i,volume:1000,amount:100000,average:100+i,turnoverPct:1})));
 w.ResizeObserver=class{observe(){}disconnect(){}};
 w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});
 w.fetch=async url=>{requests.push(url);let j;if(url.startsWith('/api/market/bars'))j={symbol:'SH600519',name:'测试',period:new URL(url,'http://localhost').searchParams.get('period'),label:'日K',kind:'candle',adjust:'1',bars,volumeUnit:'手',source:{url:'https://example.com/data'},note:'测试'};else if(url.startsWith('/api/market/quote'))j={symbol:'SH600519',name:'测试',price:100,currency:'CNY'};else j={available:false,reason:'未接入境外资金',daily:[],intraday:[],sources:[]};return {ok:true,json:async()=>j};};
 w.eval(script);w.dispatchEvent(new w.CustomEvent('stock-open-market',{detail:{symbol:'600519'}}));await new Promise(r=>setTimeout(r,30));assert.ok(w.document.querySelector('#terminal-canvas'));assert.match(w.document.querySelector('#market-crosshair').textContent,/成交量/);assert.match(w.document.querySelector('#market-indicator').textContent,/MACD/);
 const lower=w.document.querySelector('#lower-indicator');lower.value='kdj';lower.dispatchEvent(new w.Event('change'));assert.match(w.document.querySelector('#market-indicator').textContent,/K /);lower.value='rsi';lower.dispatchEvent(new w.Event('change'));assert.match(w.document.querySelector('#market-indicator').textContent,/RSI14/);
 w.document.querySelector('[data-period="102"]').click();await new Promise(r=>setTimeout(r,20));assert.ok(requests.some(x=>x.includes('period=102')));w.document.querySelector('#chart-zoom-in').click();w.document.querySelector('#chart-zoom-out').click();w.document.querySelector('#chart-reset').click();assert.ok(requests.every(x=>x.startsWith('/api/market/')));dom.window.close();
});
test('KDJ/BOLL warmup remains missing and MACD histogram follows Chinese convention',()=>{const bars=addIndicators(Array.from({length:30},(_,i)=>({close:100+i,high:101+i,low:99+i,volume:100})));assert.equal(bars[0].k,null);assert.equal(bars[18].bollUpper,null);assert.ok(bars[19].bollUpper>bars[19].ma20);assert.equal(bars.at(-1).macd,2*(bars.at(-1).dif-bars.at(-1).dea));});
