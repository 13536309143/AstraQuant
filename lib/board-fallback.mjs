import{readFile,writeFile,mkdir}from'node:fs/promises';
import{cached}from'./data.mjs';
import{getSnapshot}from'./panorama.mjs';
const folder=new URL('../data/panorama/',import.meta.url);let pending=null;
async function memberships(){
 if(pending)return pending;
 pending=(async()=>{const file=new URL('memberships.json',folder);try{const old=JSON.parse(await readFile(file,'utf8'));if(Date.now()-Date.parse(old.fetchedAt)<86400000)return old;}catch{}
  const load=async page=>{const url='https://datacenter.eastmoney.com/securities/api/data/v1/get?'+new URLSearchParams({reportName:'RPT_F10_ORG_BASICINFO',columns:'SECUCODE,SECURITY_CODE,SECURITY_NAME_ABBR,BLGAINIAN,BLGAINIAN_CODE,BOARD_NAME_2LEVEL,BOARD_CODE_BK_2LEVEL',filter:'(SECURITY_TYPE_CODE="058001001")(LISTING_STATE="0")',pageSize:'500',pageNumber:String(page),sortColumns:'SECURITY_CODE',sortTypes:'1',source:'F10',client:'PC'}),r=await cached(url,{ttl:86400000}),j=JSON.parse(r.text);if(!j.result?.data?.length)throw Error('行业/概念归属资料不可用');return {rows:j.result.data,pages:j.result.pages,total:j.result.count,source:{url,fetchedAt:r.fetchedAt,stale:!!r.stale}};};
  const first=await load(1);if(first.pages>60)throw Error('归属资料超出分页上限');const all=[first];for(let page=2;page<=first.pages;page+=4)all.push(...await Promise.all(Array.from({length:Math.min(4,first.pages-page+1)},(_,i)=>load(page+i))));const value={fetchedAt:new Date().toISOString(),rows:all.flatMap(r=>r.rows),sources:all.map(r=>r.source),expectedTotal:first.total};await mkdir(folder,{recursive:true});await writeFile(file,JSON.stringify(value));return value;
 })();try{return await pending;}finally{pending=null;}
}
export function aggregateMembership(profileRows,stockRows,type){
 const stocks=new Map(stockRows.map(r=>[r.code+'.'+r.symbol.slice(0,2),r])),groups=new Map();let matched=0;
 for(const p of profileRows){const r=stocks.get(p.SECUCODE);if(!r)continue;matched++;const names=type==='industry'?[p.BOARD_NAME_2LEVEL]:String(p.BLGAINIAN||'').split(','),codes=type==='industry'?[p.BOARD_CODE_BK_2LEVEL]:String(p.BLGAINIAN_CODE||'').split(',');
  for(const [i,code]of [...new Set(codes)].map(code=>[codes.indexOf(code),code])){if(!/^BK\d{4,6}$/.test(code)||!names[i])continue;const g=groups.get(code)||{symbol:'BOARD:'+code,name:names[i],price:null,changePct:null,amount:0,mainNet:0,mainRatio:null,sampleCount:0,returnCount:0,returnSum:0,leader:null,leaderSymbol:null,leaderChange:-Infinity};g.sampleCount++;if(r.amount!==null)g.amount+=r.amount;if(r.mainNet!==null)g.mainNet+=r.mainNet;if(r.amount>0&&r.changePct!==null){g.returnCount++;g.returnSum+=r.changePct;if(r.changePct>g.leaderChange){g.leaderChange=r.changePct;g.leader=r.name;g.leaderSymbol=r.symbol;}}groups.set(code,g);}
 }
 return {matched,rows:[...groups.values()].map(({returnSum,returnCount,leaderChange,...r})=>({...r,changePct:returnCount?returnSum/returnCount:null,returnCount}))};
}
export async function derivedBoards(type,reason){const data=await getSnapshot('CN');if(!data.rows.length)throw Error('需要先同步 A 股股票池才能计算板块备用全景');const members=await memberships(),out=aggregateMembership(members.rows,data.rows,type);return {type,method:'membership_equal_weight',fetchedAt:new Date().toISOString(),expectedTotal:out.rows.length,complete:members.rows.length===members.expectedTotal&&data.complete,rows:out.rows,sources:members.sources,mappingCount:members.rows.length,matchedStocks:out.matched,totalStocks:data.count,quoteTimeMax:data.quoteTimeMax,note:`板块报价接口暂不可用（${String(reason).slice(0,120)}），当前使用上市公司行业/概念归属资料与 A 股快照计算样本等权涨跌，非官方板块指数，无指数点位。归属匹配 ${out.matched}/${data.count} 条，资料可能滞后；行业和概念重叠，成交额/资金不可跨板块直接加总。`};}
