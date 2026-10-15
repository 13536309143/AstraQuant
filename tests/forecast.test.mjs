import test from 'node:test';import assert from 'node:assert/strict';
import {signalAt,prediction} from '../lib/forecast.mjs';
test('forecasts are invariant to any future price changes',()=>{
 const bars=Array.from({length:400},(_,i)=>({date:String(i),open:100+i*.1,close:100+i*.1+Math.sin(i)}));
 const first=signalAt(bars,250),mutated=bars.map((b,i)=>i>250?{...b,close:1e6-i*1000}:b);
 assert.deepEqual(signalAt(mutated,250),first);assert.equal(first.direction,1);assert.equal(first.riskGate,false);assert.equal(prediction(first,'without_trend'),1);assert.throws(()=>signalAt(bars,199));
});
