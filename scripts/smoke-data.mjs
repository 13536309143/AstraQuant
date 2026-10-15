import {collect}from'../lib/data.mjs';
for(const symbol of process.argv.slice(2).length?process.argv.slice(2):['600519','00700.HK','AAPL']){
 const start=Date.now();try{const d=await collect(symbol);console.log(JSON.stringify({symbol:d.symbol,name:d.name,ms:Date.now()-start,sources:d.sources.length,price:d.quote.price,bars:d.technical.barCount,report:d.fundamentals.reportDate,currency:d.fundamentals.currency,pe:d.fundamentals.peTTM,roe:d.fundamentals.roeTTM,coverage:d.assessment.coverage,annual:d.fundamentals.annualHistory?.length,raw:Object.fromEntries(Object.entries(d.statements).map(([k,v])=>[k,v.length])),warnings:d.warnings}));}catch(e){console.log(symbol,e.message);process.exitCode=1;}
}
