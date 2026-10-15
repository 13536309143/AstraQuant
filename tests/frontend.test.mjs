import{test}from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{JSDOM}from'jsdom';
import{technical,assess}from'../lib/analytics.mjs';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8'),script=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
async function setup(){
 const dom=new JSDOM(html,{url:'http://127.0.0.1:8787/',runScripts:'outside-only'}),w=dom.window,requests=[];
 w.fetch=async(url,options)=>{requests.push({url,options});let payload={};if(url==='/api/health')payload={ok:true,model:{model:'MiniMax-M3',configured:true,concurrency:2},roles:[{id:'fundamental',name:'基本面研究员'}]};else if(url==='/api/workspace')payload={watchlist:[{symbol:'US:AAPL',name:'Apple <script>alert(1)</script>'}],portfolio:[]};else if(url==='/api/jobs')payload=[];return {ok:true,json:async()=>payload};};
 w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});
 w.eval(script+'\nglobalThis.testSetJob = job => { state.job=job; renderJob(); };');await new Promise(r=>setTimeout(r,50));return {dom,w,requests};
}
test('frontend initializes all nine pages and escapes external names',async()=>{const{dom,w}=await setup();assert.equal(w.document.querySelectorAll('.page').length,9);assert.match(w.document.querySelector('#model-badge').textContent,/MiniMax-M3/);assert.equal(w.document.querySelector('#watchlist script'),null);assert.match(w.document.querySelector('#watchlist').textContent,/<script>/);for(const b of w.document.querySelectorAll('#nav button')){b.click();assert.equal(w.document.querySelector('.page.active').id,'page-'+b.dataset.page);}dom.window.close();});
test('frontend renders all evidence tabs with missing financial data',async()=>{const{dom,w}=await setup();const tech=technical(Array.from({length:250},(_,i)=>({date:'2026-01-'+String(i),open:10,close:10+i/100,high:20,low:9,volume:100}))),f={available:false,missing:['未核验 ESG'],annualHistory:[],notes:['测试']},a=assess(f,tech,{}),job={id:'test-job',symbol:'US:AAPL',status:'completed',mode:'data',style:'均衡',created:new Date().toISOString(),updated:new Date().toISOString(),usage:{total_tokens:0},agents:[],events:[],data:{name:'测试 <img src=x onerror=alert(1)>',symbol:'US:AAPL',collectedAt:new Date().toISOString(),quote:{currency:'USD',price:12,timestamp:'2026-10-14'},fundamentals:f,technical:tech,assessment:a,peers:[],announcements:[],macro:{cpi:[],gdp:[],scope:'中国宏观'},sources:[],warnings:[],statements:{}},report:{summary:'证据不足',stance:'证据不足',confidence:'低',body:'## 测试\n\n<script>alert(1)</script>'}};
 w.testSetJob(job);assert.equal(w.document.querySelector('#job-view img'),null);assert.equal(w.document.querySelector('#tab-content script'),null);for(const name of ['agents','finance','context','sources','summary']){w.document.querySelector(`[data-tab="${name}"]`).click();assert.ok(w.document.querySelector('#tab-content').textContent.trim().length>0);}dom.window.close();});
