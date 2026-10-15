import assert from'node:assert/strict';
import{getSnapshot,indexQuotes,boardQuotes}from'../lib/panorama.mjs';
import{marketBars,marketQuote}from'../lib/market.mjs';
for(const market of ['CN','HK','US']){const d=await getSnapshot(market);assert.ok(d.rows.length>1000);assert.equal(d.count,d.expectedTotal);assert.equal(d.complete,true);assert.equal(new Set(d.rows.map(r=>r.secid)).size,d.rows.length);assert.equal(d.summary.up+d.summary.down+d.summary.flat+d.summary.inactive,d.count);console.log(market,d.count,'records; full pagination and breadth verified');}
const indices=await indexQuotes();assert.equal(indices.indices.filter(i=>i.available).length,15);console.log('15 index quotes verified');
for(const type of ['industry','concept']){const d=await boardQuotes(type);assert.equal(d.complete,true);assert.equal(d.rows.length,d.expectedTotal);console.log(type,d.rows.length,'boards');}
for(const symbol of ['IDX:SH000001','IDX:HSTECH','IDX:SPX','BOARD:BK1277']){const b=await marketBars(symbol,'101'),q=await marketQuote(symbol);assert.ok(q.price>0);assert.ok(b.bars.length>200);assert.equal(b.adjust,'0');console.log(symbol,q.name,b.bars.length,'daily bars');}
