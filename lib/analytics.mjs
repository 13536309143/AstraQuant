export const num = v => v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
export const ratio = (a,b,scale=1) => num(a)!==null && num(b)!==null && Number(b)!==0 ? Number(a)/Number(b)*scale : null;
export const mean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : null;
export function sma(a,n){return a.map((_,i)=>i<n-1?null:mean(a.slice(i-n+1,i+1)));}
export function ema(a,n){const k=2/(n+1);let prev=null;return a.map(v=>prev=prev===null?v:v*k+prev*(1-k));}
export function rsi(a,n=14){let gain=0,loss=0;return a.map((v,i)=>{if(!i)return null;const d=v-a[i-1];if(i<=n){gain+=Math.max(d,0)/n;loss+=Math.max(-d,0)/n;}else{gain=(gain*(n-1)+Math.max(d,0))/n;loss=(loss*(n-1)+Math.max(-d,0))/n;}return i<n?null:loss===0?(gain===0?50:100):100-100/(1+gain/loss);});}
export function technical(bars){
 if(!bars.length)return {available:false};
 const c=bars.map(b=>b.close),n=c.length,last=c.at(-1),e12=ema(c,12),e26=ema(c,26),dif=c.map((_,i)=>e12[i]-e26[i]),dea=ema(dif,9),m20=sma(c,20),m50=sma(c,50),m200=sma(c,200),r=rsi(c),sample=c.slice(-20),std=sample.length===20?Math.sqrt(mean(sample.map(v=>(v-m20.at(-1))**2))):null;
 const returns=c.slice(1).map((v,i)=>v/c[i]-1),vol=returns.length>1?Math.sqrt(mean(returns.map(v=>(v-mean(returns))**2)))*Math.sqrt(252)*100:null;
 let peak=c[0],dd=0;for(const p of c){peak=Math.max(peak,p);dd=Math.min(dd,p/peak-1);}
 const previous=bars.slice(-61,-1),support=previous.length?Math.min(...previous.map(b=>b.low)):null,resistance=previous.length?Math.max(...previous.map(b=>b.high)):null;
 return {available:true,barCount:n,date:bars.at(-1).date,adjustment:'前复权；MA/MACD/支撑阻力仅在此复权序列内比较',close:last,ma20:m20.at(-1),ma50:m50.at(-1),ma200:m200.at(-1),rsi14:r.at(-1),macd:{dif:dif.at(-1),dea:dea.at(-1),histogram:2*(dif.at(-1)-dea.at(-1)),bullishCross:n>35&&dif.at(-2)<=dea.at(-2)&&dif.at(-1)>dea.at(-1)},bollinger:{middle:m20.at(-1),upper:std===null?null:m20.at(-1)+2*std,lower:std===null?null:m20.at(-1)-2*std},goldenCross:n>=201&&m50.at(-2)<=m200.at(-2)&&m50.at(-1)>m200.at(-1),support60:support,resistance60:resistance,volumeRatio20:n>=21?ratio(bars.at(-1).volume,mean(bars.slice(-21,-1).map(b=>b.volume))):null,breakout:n>=61&&last>resistance,annualVolatilityPct:vol,maxDrawdownPct:dd*100,return20Pct:n>20?(last/c.at(-21)-1)*100:null,return60Pct:n>60?(last/c.at(-61)-1)*100:null,series:bars.map((b,i)=>({...b,ma20:m20[i],ma50:m50[i],ma200:m200[i],rsi:r[i]}))};
}
export function ttm(rows,key){
 const latest=rows[0];if(!latest)return null;
 const date=latest.REPORT_DATE.slice(0,10),year=Number(date.slice(0,4)),md=date.slice(5);
 if(md==='12-31')return num(latest[key]);
 const annual=rows.find(r=>r.REPORT_DATE.startsWith(`${year-1}-12-31`)),prior=rows.find(r=>r.REPORT_DATE.startsWith(`${year-1}-${md}`));
 return [latest[key],annual?.[key],prior?.[key]].every(v=>num(v)!==null)?Number(latest[key])+Number(annual[key])-Number(prior[key]):null;
}
export function fundamentals(income=[],balance=[],cash=[],summary=[],quote={}){
 // Never align statements by array index: reporting schedules may differ.
 const dates=income.map(r=>r.REPORT_DATE).filter(d=>balance.some(r=>r.REPORT_DATE===d)&&cash.some(r=>r.REPORT_DATE===d));
 const date=dates.sort().at(-1);if(!date)return {available:false,missing:['未取得同一报告期的三大财务报表']};
 const i=income.find(r=>r.REPORT_DATE===date),b=balance.find(r=>r.REPORT_DATE===date),c=cash.find(r=>r.REPORT_DATE===date),s=summary.find(r=>r.REPORT_DATE===date)||{};
 const inc=income.filter(r=>r.REPORT_DATE<=date),cf=cash.filter(r=>r.REPORT_DATE<=date),profitTTM=ttm(inc,'PARENT_NETPROFIT'),revenueTTM=ttm(inc,'TOTAL_OPERATE_INCOME'),cfoTTM=ttm(cf,'NETCASH_OPERATE'),capexTTM=ttm(cf,'CONSTRUCT_LONG_ASSET');
 const previousYear=balance.find(r=>r.REPORT_DATE.startsWith(`${Number(date.slice(0,4))-1}${date.slice(4,10)}`));
 const averageEquity=previousYear&&num(b.TOTAL_PARENT_EQUITY)!==null&&num(previousYear.TOTAL_PARENT_EQUITY)!==null?(Number(b.TOTAL_PARENT_EQUITY)+Number(previousYear.TOTAL_PARENT_EQUITY))/2:null;
 const shares=num(b.SHARE_CAPITAL),pe=profitTTM>0&&quote.marketCap?quote.marketCap/profitTTM:null,growth=num(i.PARENT_NETPROFIT_YOY),fcf=cfoTTM!==null&&capexTTM!==null?cfoTTM-capexTTM:null;
 const annual=inc.filter(r=>r.REPORT_DATE.slice(5,10)==='12-31').slice(0,5).map(r=>{const y=Number(r.REPORT_DATE.slice(0,4));const end=balance.find(b=>b.REPORT_DATE.startsWith(`${y}-12-31`)),start=balance.find(b=>b.REPORT_DATE.startsWith(`${y-1}-12-31`));return {year:y,revenue:num(r.TOTAL_OPERATE_INCOME),netProfit:num(r.PARENT_NETPROFIT),roe:end&&start?ratio(r.PARENT_NETPROFIT,(Number(end.TOTAL_PARENT_EQUITY)+Number(start.TOTAL_PARENT_EQUITY))/2,100):null};});
 const result={available:true,reportDate:date.slice(0,10),noticeDate:i.NOTICE_DATE?.slice(0,10),currency:i.CURRENCY||'CNY',industry:s.INDUSTRY_NAME||null,totalAssets:num(b.TOTAL_ASSETS),totalLiabilities:num(b.TOTAL_LIABILITIES),debtRatio:ratio(b.TOTAL_LIABILITIES,b.TOTAL_ASSETS,100),currentRatio:ratio(b.TOTAL_CURRENT_ASSETS,b.TOTAL_CURRENT_LIAB),quickRatio:num(b.TOTAL_CURRENT_ASSETS)!==null&&num(b.INVENTORY)!==null?ratio(Number(b.TOTAL_CURRENT_ASSETS)-Number(b.INVENTORY),b.TOTAL_CURRENT_LIAB):null,revenueYtd:num(i.TOTAL_OPERATE_INCOME),netProfitYtd:num(i.PARENT_NETPROFIT),deductedProfitYtd:num(i.DEDUCT_PARENT_NETPROFIT??s.DEDUCT_PARENT_NETPROFIT),revenueGrowth:num(i.TOTAL_OPERATE_INCOME_YOY??s.TOI_RATIO),profitGrowth:growth,netMargin:ratio(i.NETPROFIT,i.TOTAL_OPERATE_INCOME,100),grossMargin:num(i.OPERATE_INCOME)!==null&&num(i.OPERATE_COST)!==null?ratio(Number(i.OPERATE_INCOME)-Number(i.OPERATE_COST),i.OPERATE_INCOME,100):null,roeTTM:ratio(profitTTM,averageEquity,100),profitTTM,revenueTTM,cfoYtd:num(c.NETCASH_OPERATE),cfoTTM,capexTTM,fcfTTM:fcf,cashProfitRatio:ratio(cfoTTM,ttm(inc,'NETPROFIT')),peTTM:pe,pb:ratio(quote.marketCap,b.TOTAL_PARENT_EQUITY),peg:pe>0&&growth>0?pe/growth:null,shares,receivablesGrowth:num(b.ACCOUNTS_RECE_YOY),inventoryGrowth:num(b.INVENTORY_YOY),cash:num(b.MONETARYFUNDS),annualHistory:annual,dividendYield:null,notes:['金额单位为报表本币元；比率为倍数；以 Pct 或 Growth/Margin/ROE 命名的字段为百分数。','利润/现金流为年初至今累计值；TTM=本期累计+上年全年−上年同期；ROE 使用 TTM 归母利润/期初期末归母权益均值，非公告加权 ROE。','FCF 为 CFO−购建长期资产现金支出的代理口径，非严格 FCFF/FCFE；不直接用于目标价。','PEG 使用最新累计归母净利润同比，并非长期盈利预测；负增长不计算 PEG。','速动比率采用（流动资产−存货）/流动负债，未进一步扣除预付款等项目。']};
 result.missing=['MSCI ESG 授权评级','股权质押明细与关联交易结构化数据','最新已核验股息率','商业市占率与 CR5','实时宏观政策全文','完整诉讼与管理层变动核验'];
 return result;
}
export function assess(f,t,quote={}){
 const items=[];const add=(label,value,score,weight,detail)=>items.push({label,value,score:num(value)===null?null:score,weight,detail});
 const financial=/银行|保险|证券|多元金融/.test(f.industry||'');
 add('盈利质量 / ROE',f.roeTTM,f.roeTTM>=15?85:f.roeTTM>8?60:30,25,'ROE 是计算口径，需结合历年稳定性');
 if(!financial){add('资产负债率',f.debtRatio,f.debtRatio<40?85:f.debtRatio<=70?55:20,15,'非金融企业通用观察阈值，须行业对比');add('现金利润比',f.cashProfitRatio,f.cashProfitRatio>=1?85:f.cashProfitRatio>0?55:15,20,'TTM CFO / TTM 合并净利润');}
 add('营收增长',f.revenueGrowth,f.revenueGrowth>15?85:f.revenueGrowth>=0?60:25,15,'最新累计同比，不代表未来预测');
 add('盈利增长',f.profitGrowth,f.profitGrowth>15?85:f.profitGrowth>=0?60:25,15,'最新累计归母利润同比');
 add('中期趋势',t.ma200,t.close>t.ma200?70:35,10,'200 日均线仅为趋势描述');
 const usable=items.filter(x=>x.score!==null),weight=usable.reduce((s,x)=>s+x.weight,0),score=weight?Math.round(usable.reduce((s,x)=>s+x.score*x.weight,0)/weight):null;
 const required=financial?['debtRatio','roeTTM','peTTM','pb','profitGrowth','revenueGrowth']:['debtRatio','currentRatio','quickRatio','roeTTM','peTTM','grossMargin','profitGrowth','cfoTTM','fcfTTM'],coverage=Math.round(required.filter(k=>num(f[k])!==null).length/required.length*100),risks=[];
 if(!f.available)risks.push('缺少可对齐的财报，无法形成基本面推荐');
 if(!financial&&f.debtRatio>70)risks.push('资产负债率高于 70%，需检查行业背景及偿债安排');
 if(f.cfoTTM!==null&&f.cfoTTM<0)risks.push('经营现金流 TTM 为负');
 if(f.profitGrowth!==null&&f.profitGrowth<0)risks.push('归母净利润累计同比下降');
 if(f.receivablesGrowth!==null&&f.revenueGrowth!==null&&f.receivablesGrowth>f.revenueGrowth+30)risks.push('应收账款增速显著高于收入增速');
 if(t.rsi14>70)risks.push('RSI 高于 70，存在过热风险，不能据此预测反转');
 if(t.barCount<200||!t.available)risks.push('日线少于 200 根或不可用，长趋势指标不足');
 if(quote.stale)risks.push('行情日期偏旧，报告仅供历史研究');
 if(financial)risks.push('金融行业：流动/速动比率、通用杠杆阈值与 CFO−Capex 不适合作为核心筛选标准');
 return {score,coverage,components:items,risks,financialIndustry:financial,label:coverage<70?'证据不足':score>=75?'优先研究':score>=55?'持续观察':'谨慎研究',method:'透明规则评分，不是收益概率；未计入治理、ESG、政策及完整同业估值。缺项不按零分处理。'};
}
export function dcf({fcff,netDebt=0,shares,growth=.05,discount=.10,terminal=.02,years=5}){
 if(![fcff,netDebt,shares,growth,discount,terminal,years].every(Number.isFinite)||fcff<=0||shares<=0||discount<=terminal||discount<=0||terminal<0||growth<=-1||years<1||years>20||!Number.isInteger(years))throw Error('DCF 参数无效：FCFF、股数须为正，折现率须大于永续增长率，年数为 1–20 的整数');
 let flow=fcff,pv=0;const flows=[];for(let y=1;y<=years;y++){flow*=1+growth;const present=flow/(1+discount)**y;pv+=present;flows.push({year:y,fcff:flow,pv:present});}const terminalPV=flow*(1+terminal)/(discount-terminal)/(1+discount)**years,enterprise=pv+terminalPV,equity=enterprise-netDebt;
 return {enterprise,equity,perShare:equity/shares,terminalShare:terminalPV/enterprise,flows,assumptions:{fcff,netDebt,shares,growth,discount,terminal,years},note:'企业自由现金流 FCFF / WACC 模型；股权价值=企业价值−净债务。输入需自行核验，不自动把 CFO−Capex 当作 FCFF。'};
}
export function backtest(bars,{fast=50,slow=200,feeBps=10}={}){
 if(!Number.isInteger(fast)||!Number.isInteger(slow)||fast<2||slow<=fast||slow>300||!Number.isFinite(feeBps)||feeBps<0||feeBps>200)throw Error('回测参数无效');
 if(bars.length<slow+20)throw Error('日线不足，需要慢均线窗口加 20 个交易日');
 const c=bars.map(b=>b.close),a=sma(c,fast),b=sma(c,slow);let nav=1,benchmark=1,pos=0,peak=1,maxDD=0,trades=0;const curve=[];
 // Signal observed at i-2 close. Execute at i-1 close; earn i-1 -> i return.
 for(let i=slow+1;i<c.length;i++){const target=a[i-2]>b[i-2]?1:0;if(target!==pos){nav*=1-feeBps/10000;trades++;pos=target;}nav*=1+pos*(c[i]/c[i-1]-1);benchmark*=c[i]/c[i-1];peak=Math.max(peak,nav);maxDD=Math.min(maxDD,nav/peak-1);curve.push({date:bars[i].date,strategy:nav,benchmark,position:pos});}
 const terminalFee=pos?feeBps/10000:0;nav*=1-terminalFee;if(pos)trades++;maxDD=Math.min(maxDD,nav/peak-1);if(curve.length)curve.at(-1).strategy=nav;
 return {start:curve[0]?.date,end:curve.at(-1)?.date,totalReturnPct:(nav-1)*100,benchmarkReturnPct:(benchmark-1)*100,annualizedPct:(nav**(252/curve.length)-1)*100,maxDrawdownPct:maxDD*100,trades,curve,assumptions:{fast,slow,feeBps},note:'信号延迟一根日线，于下一交易日收盘执行；单边成本含费用滑点，期末平仓。前复权价格近似处理分红，不处理停牌、涨跌停成交、税费差异与幸存者偏差；结果不能预测未来。'};
}
