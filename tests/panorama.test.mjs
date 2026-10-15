import{test}from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{JSDOM}from'jsdom';
import{normalizeRow,summarize,histogram}from'../lib/panorama.mjs';
import{normalizeSymbol}from'../lib/data.mjs';
import{indexOf}from'../lib/instruments.mjs';
import{aggregateMembership}from'../lib/board-fallback.mjs';
import * as viz from'../public/panorama-viz.js';
test('index symbols never collide with stocks; new BSE codes and HK currency counters normalize',()=>{
 assert.equal(normalizeSymbol('000001'),'SZ000001');assert.equal(normalizeSymbol('IDX:SH000001'),'IDX:SH000001');assert.equal(indexOf('IDX:SH000001').secid,'1.000001');assert.equal(normalizeSymbol('920992'),'BJ920992');assert.equal(normalizeRow({f12:'920992',f13:0},'CN').symbol,'BJ920992');assert.equal(normalizeRow({f12:'80700',f13:128},'HK').currency,'CNY');assert.equal(normalizeRow({f12:'00700',f13:128},'HK').currency,'HKD');assert.throws(()=>normalizeSymbol('IDX:UNKNOWN'));assert.equal(normalizeRow({f12:'X',f62:0},'US').mainNet,null);
});
const rows=[
 {symbol:'SH600001',secid:'1.600001',code:'600001',name:'甲公司',industry:'行业甲',currency:'CNY',market:'CN',price:10,changePct:2,amount:100,marketCap:200000000,turnover:2,peTTM:10,pb:1,mainNet:20},
 {symbol:'SH600002',secid:'1.600002',code:'600002',name:'乙公司',industry:'行业甲',currency:'CNY',market:'CN',price:20,changePct:-4,amount:200,marketCap:600000000,turnover:4,peTTM:-20,pb:2,mainNet:-10},
 {symbol:'SH600003',secid:'1.600003',code:'600003',name:'ST丙公司',industry:'行业乙',currency:'CNY',market:'CN',price:30,changePct:0,amount:30,marketCap:100000000,turnover:0,peTTM:null,pb:3,mainNet:null},
 {symbol:'SH600004',secid:'1.600004',code:'600004',name:'无成交',industry:'行业乙',currency:'CNY',market:'CN',price:15,changePct:0,amount:0,marketCap:300000000,turnover:0,peTTM:30,pb:4,mainNet:0}
];
test('breadth, valuation and industry averages exclude missing data without mixing currencies',()=>{
 const a=summarize([...rows,{...rows[0],symbol:'HK80700',currency:'HKD',amount:10000,changePct:50}],'CN');assert.equal(a.up,2);assert.equal(a.down,1);assert.equal(a.flat,1);assert.equal(a.inactive,1);assert.equal(a.amount,330);assert.equal(a.excludedCurrency,1);assert.equal(a.medianPE,20);assert.equal(a.mainNet,10);assert.equal(a.industries.find(g=>g.name==='行业甲').averageChange,-1);assert.equal(a.changeHistogram.bins.reduce((s,b)=>s+b.count,0),a.active);assert.equal(histogram([{x:null},{x:-2},{x:0},{x:2}],'x',[0]).missing,1);
});
test('filters and sorting keep missing numeric values distinct from zero and exclude losses for PE filters',()=>{
 assert.deepEqual(viz.filterRows(rows,{minChange:'0'}).map(r=>r.symbol),['SH600001','SH600003','SH600004']);assert.equal(viz.filterRows(rows,{maxPE:'25'}).length,1);assert.equal(viz.filterRows(rows,{query:'行业甲',minCap:'3'}).length,1);assert.equal(viz.filterRows(rows,{excludeST:true}).length,3);assert.equal(viz.sortRows(rows,'peTTM',false).at(-1).peTTM,null);
});
test('exact ticker search takes precedence over mentions in other security names',()=>{
 const a=[{symbol:'US:AAPL',code:'AAPL',name:'苹果',industry:'技术'},{symbol:'US:XVAP',code:'XVAP',name:'AAPL ETF',industry:'其他'},{symbol:'US:AAPL22',code:'AAPL22',name:'Apple Notes',industry:'其他'}];assert.deepEqual(viz.filterRows(a,{query:'aapl'}).map(r=>r.symbol),['US:AAPL']);
});
test('treemap preserves all positive weights, tiles area and non-overlap',()=>{
 const tiles=viz.treemap([{name:'a',weight:6},{name:'b',weight:3},{name:'c',weight:1},{name:'missing',weight:0}],0,0,100,80);assert.equal(tiles.length,3);assert.ok(Math.abs(tiles.reduce((s,t)=>s+t.width*t.height,0)-8000)<1e-8);for(const a of tiles)for(const b of tiles)if(a!==b)assert.ok(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)<=1e-8||Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)<=1e-8);
});
test('star placement is deterministic, caps only display samples and keeps real row references',()=>{
 const a=viz.starLayout(rows,'amount',2),b=viz.starLayout(rows,'amount',2);assert.equal(a.sampleCount,2);assert.equal(a.totalCount,4);assert.equal(a.nodes[0].row,rows[1]);assert.deepEqual(a.nodes.map(n=>[n.x,n.y]),b.nodes.map(n=>[n.x,n.y]));
});
test('index comparison aligns common dates before rebasing, never by row offset',()=>{
 const result=viz.alignComparison([{name:'A',bars:[{time:'2026-01-01',close:10},{time:'2026-01-02',close:20},{time:'2026-01-03',close:30}]},{name:'B',bars:[{time:'2026-01-02',close:40},{time:'2026-01-03',close:44}]}]);assert.deepEqual(result.dates,['2026-01-02','2026-01-03']);assert.deepEqual(result.lines[0].values,[100,150]);assert.ok(Math.abs(result.lines[1].values[1]-110)<1e-10);
});
test('board fallback deduplicates concept membership and labels equal-weight returns without index points',()=>{
 const profiles=[{SECUCODE:'600001.SH',BLGAINIAN:'概念甲,概念乙,概念甲',BLGAINIAN_CODE:'BK0001,BK0002,BK0001'},{SECUCODE:'600002.SH',BLGAINIAN:'概念甲',BLGAINIAN_CODE:'BK0001'}];const result=aggregateMembership(profiles,rows,'concept');assert.equal(result.matched,2);const board=result.rows.find(r=>r.symbol==='BOARD:BK0001');assert.equal(board.sampleCount,2);assert.equal(board.changePct,-1);assert.equal(board.price,null);assert.equal(board.amount,300);
});
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8'),script=(await readFile(new URL('../public/panorama.js',import.meta.url),'utf8')).replace(/^import .*?;\r?\n/,'');
test('panorama UI renders real-data tabs, filters stocks, and links an index with its explicit namespace',async()=>{
 const dom=new JSDOM(html,{url:'http://127.0.0.1:8787',runScripts:'outside-only'}),w=dom.window,calls=[],events=[];const oldResize=globalThis.ResizeObserver;globalThis.ResizeObserver=class{observe(){}disconnect(){}};
 w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({measureText:text=>({width:text.length*8})},{get:(t,k)=>k in t?t[k]:()=>{}});
 Object.assign(w,viz);const data={market:'CN',fetchedAt:new Date().toISOString(),expectedTotal:rows.length,count:rows.length,rows,complete:true,summary:summarize(rows,'CN'),sources:[],sync:{status:'completed'},warnings:[]};
 w.fetch=async(url,options)=>{calls.push({url,options});let j=data;if(url.includes('/indices'))j={indices:[{symbol:'IDX:SH000001',name:'上证指数',market:'CN',currency:'CNY',price:3000,changePct:1,available:true}]};if(url.includes('/boards'))j={rows:[{symbol:'BOARD:BK0001',name:'板块测试',changePct:1}],complete:true,note:'口径测试'};if(url.includes('/market/bars'))j={name:'上证指数',bars:[{time:'2026-01-01',close:100},{time:'2026-01-02',close:110}]};return {ok:true,json:async()=>j};};
 w.addEventListener('stock-navigate',ev=>events.push(ev.detail));w.eval(script);w.dispatchEvent(new w.CustomEvent('stock-page-change',{detail:'stars'}));await new Promise(r=>setTimeout(r,40));assert.match(w.document.querySelector('#star-visible').textContent,/4/);assert.ok(w.document.querySelector('#star-sync-state').textContent.includes('完整'));
 w.dispatchEvent(new w.CustomEvent('stock-page-change',{detail:'center'}));await new Promise(r=>setTimeout(r,10));for(const tab of ['industries','concepts','capital','valuation','stocks','sources','indices']){w.document.querySelector(`[data-center-tab="${tab}"]`).click();await new Promise(r=>setTimeout(r,15));assert.ok(w.document.querySelector('#center-content').textContent.length>10);}
 w.document.querySelector('#center-content [data-open="IDX:SH000001"]').click();assert.equal(events.at(-1).symbol,'IDX:SH000001');assert.equal(events.at(-1).page,'market');
 w.document.querySelector('[data-center-tab="stocks"]').click();const q=w.document.querySelector('[data-filter="query"]');q.value='乙公司';q.dispatchEvent(new w.Event('input'));assert.equal(w.document.querySelectorAll('#stocks-table tbody tr').length,1);assert.match(w.document.querySelector('#stocks-table').textContent,/乙公司/);assert.ok(calls.every(c=>!c.url.includes('/api/jobs')));globalThis.ResizeObserver=oldResize;dom.window.close();
});
