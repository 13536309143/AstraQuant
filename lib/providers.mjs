// Native protocol adapters. Credentials never leave this module in returned config.
export const PROVIDERS={
 minimax:{base:'https://api.minimax.cn/v1',protocol:'chat',model:'MiniMax-M3',hosts:['api.minimax.cn','api.minimax.io','api.minimaxi.com']},
 openai:{base:'https://api.openai.com/v1',protocol:'responses',hosts:['api.openai.com']},
 anthropic:{base:'https://api.anthropic.com/v1',protocol:'anthropic',hosts:['api.anthropic.com']},
 gemini:{base:'https://generativelanguage.googleapis.com/v1beta',protocol:'gemini',hosts:['generativelanguage.googleapis.com']},
 deepseek:{base:'https://api.deepseek.com/v1',protocol:'chat',model:'deepseek-chat',hosts:['api.deepseek.com']},
 qwen:{base:'https://dashscope.aliyuncs.com/compatible-mode/v1',protocol:'chat',model:'qwen-plus',hosts:['dashscope.aliyuncs.com','dashscope-intl.aliyuncs.com','dashscope-us.aliyuncs.com']},
 moonshot:{base:'https://api.moonshot.cn/v1',protocol:'chat',hosts:['api.moonshot.cn','api.moonshot.ai']},
 zhipu:{base:'https://open.bigmodel.cn/api/paas/v4',protocol:'chat',hosts:['open.bigmodel.cn']},
 siliconflow:{base:'https://api.siliconflow.cn/v1',protocol:'chat',hosts:['api.siliconflow.cn','api.siliconflow.com','api-st.siliconflow.cn']},
 openrouter:{base:'https://openrouter.ai/api/v1',protocol:'chat',hosts:['openrouter.ai']},
 groq:{base:'https://api.groq.com/openai/v1',protocol:'chat',hosts:['api.groq.com']},
 xai:{base:'https://api.x.ai/v1',protocol:'chat',hosts:['api.x.ai']},
 ark:{base:'https://ark.cn-beijing.volces.com/api/v3',protocol:'chat',hosts:['ark.cn-beijing.volces.com','ark.ap-southeast.bytepluses.com']},
 azure:{base:'',protocol:'azure',hosts:[]},
 ollama:{base:'http://127.0.0.1:11434/v1',protocol:'chat',local:true},
 custom:{base:'',protocol:'chat',hosts:[]}
};
export function redact(value,env=process.env){
 let text=String(value?.message||value);
 for(const [k,v] of Object.entries(env))if(/(?:API_KEY|TOKEN|SECRET)$/.test(k)&&v?.length>=8)text=text.replaceAll(v,'[REDACTED]');
 return text.replace(/sk-[A-Za-z0-9_-]+/g,'[REDACTED]').slice(0,600);
}
export function resolveConfig(role='',env=process.env){
 const tag=role?'AGENT_'+role.toUpperCase()+'_':'',provider=(env[tag+'PROVIDER']||env.LLM_PROVIDER||'minimax').toLowerCase(),def=PROVIDERS[provider];
 if(!def)throw Error('Unknown LLM_PROVIDER: '+provider);
 const prefix=provider.toUpperCase(),model=env[tag+'MODEL']||env[prefix+'_MODEL']||env.LLM_MODEL||def.model||'',baseUrl=(env[prefix+'_BASE_URL']||def.base).replace(/\/+$/,''),key=env[prefix+'_API_KEY']||'';
 return {provider,model,baseUrl,protocol:def.protocol,configured:!!model&&!!baseUrl&&(def.local||!!key),concurrency:Math.max(1,Math.min(3,Number(env.AGENT_CONCURRENCY)||2))};
}
export function validateEndpoint(cfg,env=process.env){
 const url=new URL(cfg.baseUrl),def=PROVIDERS[cfg.provider];
 if(url.username||url.password||url.search||url.hash)throw Error('Endpoint must not contain credentials, query parameters or fragments');
 if(def.local){if(!['http:','https:'].includes(url.protocol))throw Error('Invalid local protocol');if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&env.LLM_ALLOW_LOCAL_NETWORK!=='true')throw Error('Local network endpoint requires LLM_ALLOW_LOCAL_NETWORK=true');}
 else{
  if(url.protocol!=='https:')throw Error('Cloud endpoints require HTTPS');
  const trusted=def.hosts?.includes(url.hostname)||(cfg.provider==='azure'&&/\.(openai\.azure\.com|services\.ai\.azure\.com)$/.test(url.hostname))||(cfg.provider==='qwen'&&/^[a-z0-9-]+\.(cn-beijing|us-east-1|ap-southeast-1|ap-northeast-1)\.maas\.aliyuncs\.com$/.test(url.hostname));
  if(!trusted&&cfg.provider!=='custom'&&env.LLM_ALLOW_CUSTOM_ENDPOINTS!=='true')throw Error('Untrusted provider endpoint; use CUSTOM_API_KEY for gateways');
 }
 return url;
}
export function buildRequest(messages,{role='',maxTokens=2600,env=process.env}={}){
 const cfg=resolveConfig(role,env);if(!cfg.configured)throw Error(`Configure ${cfg.provider.toUpperCase()}_API_KEY and ${cfg.provider.toUpperCase()}_MODEL`);
 validateEndpoint(cfg,env);const prefix=cfg.provider.toUpperCase(),key=env[prefix+'_API_KEY'],headers={'Content-Type':'application/json'};let url,body;
 if(key)headers.Authorization='Bearer '+key;
 const system=messages.filter(m=>m.role==='system').map(m=>m.content).join('\n'),chat=messages.filter(m=>m.role!=='system');
 if(cfg.protocol==='responses'){
  url=cfg.baseUrl+'/responses';body={model:cfg.model,input:messages,max_output_tokens:maxTokens,store:false};
  if(env.OPENAI_REASONING_EFFORT)body.reasoning={effort:env.OPENAI_REASONING_EFFORT};
 }else if(cfg.protocol==='anthropic'){
  delete headers.Authorization;headers['x-api-key']=key;headers['anthropic-version']='2023-06-01';
  url=cfg.baseUrl+'/messages';body={model:cfg.model,system,messages:chat,max_tokens:maxTokens};
 }else if(cfg.protocol==='gemini'){
  delete headers.Authorization;headers['x-goog-api-key']=key;
  url=cfg.baseUrl+'/models/'+encodeURIComponent(cfg.model)+':generateContent';body={systemInstruction:{parts:[{text:system}]},contents:chat.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),generationConfig:{maxOutputTokens:maxTokens}};
 }else if(cfg.protocol==='azure'){
  delete headers.Authorization;headers['api-key']=key;
  url=env.AZURE_API_VERSION?cfg.baseUrl+'/openai/deployments/'+encodeURIComponent(cfg.model)+'/chat/completions?api-version='+encodeURIComponent(env.AZURE_API_VERSION):cfg.baseUrl+'/openai/v1/chat/completions';
  body={model:cfg.model,messages,max_completion_tokens:maxTokens};
 }else{
  url=cfg.baseUrl+'/chat/completions';body={model:cfg.model,messages};
  body[cfg.provider==='minimax'||env[prefix+'_TOKEN_PARAMETER']==='max_completion_tokens'?'max_completion_tokens':'max_tokens']=maxTokens;
  if(cfg.provider==='minimax')Object.assign(body,{temperature:.4,thinking:{type:'disabled'},reasoning_split:true});
  if(cfg.provider==='qwen')body.enable_thinking=false;
 }
 return {cfg,url,headers,body};
}
export function parseResponse(j,cfg){
 let content='',input=0,output=0,total,reason;
 if(j.error||j.base_resp?.status_code)throw Error(j.error?.message||j.base_resp?.status_msg||'Provider rejected request');
 if(cfg.protocol==='responses'){
  content=(j.output||[]).filter(o=>o.type==='message').flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('\n');
  input=j.usage?.input_tokens;output=j.usage?.output_tokens;reason=j.status==='incomplete'?'length':j.status==='failed'?'failed':null;
 }else if(cfg.protocol==='anthropic'){
  content=(j.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n');input=(j.usage?.input_tokens||0)+(j.usage?.cache_read_input_tokens||0)+(j.usage?.cache_creation_input_tokens||0);output=j.usage?.output_tokens;reason=j.stop_reason==='max_tokens'?'length':null;
 }else if(cfg.protocol==='gemini'){
  const c=j.candidates?.[0];content=(c?.content?.parts||[]).filter(p=>!p.thought&&p.text).map(p=>p.text).join('\n');input=j.usageMetadata?.promptTokenCount;output=(j.usageMetadata?.candidatesTokenCount||0)+(j.usageMetadata?.thoughtsTokenCount||0);total=j.usageMetadata?.totalTokenCount;reason=c?.finishReason==='MAX_TOKENS'?'length':null;
 }else{
  const c=j.choices?.[0];content=c?.message?.content||'';input=j.usage?.prompt_tokens;output=j.usage?.completion_tokens;total=j.usage?.total_tokens;reason=c?.finish_reason;
 }
 const usage={prompt_tokens:Number(input)||0,completion_tokens:Number(output)||0,total_tokens:Number(total)||((Number(input)||0)+(Number(output)||0))};
 if(reason==='length'||reason==='failed'){const err=Error('模型输出未完成，未作为有效分析保存');err.usage=usage;throw err;}
 content=typeof content==='string'?content.replace(/<think>[\s\S]*?<\/think>/g,'').trim():'';
 if(!content)throw Error('模型返回空正文或拒绝回答');return {content,usage,model:j.model||cfg.model,provider:cfg.provider};
}
export async function callProvider(messages,{signal,maxTokens=2600,role='',env=process.env,fetchImpl=fetch}={}){
 const request=buildRequest(messages,{role,maxTokens,env});
 for(let attempt=0;attempt<2;attempt++){
  signal?.throwIfAborted();let response;
  try{response=await fetchImpl(request.url,{method:'POST',redirect:'error',headers:request.headers,body:JSON.stringify(request.body),signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(Number(env.LLM_TIMEOUT_MS)||180000)])});}
  catch(e){throw Error(signal?.aborted?'任务已取消':'模型请求失败：'+redact(e,env));}
  // Only explicit rate-limit/server rejection is retried. Ambiguous network failures are not retried.
  if((response.status===429||response.status>=500)&&attempt===0){await response.body?.cancel();await new Promise(r=>setTimeout(r,1000));continue;}
  let j;try{j=await response.json();}catch{throw Error('模型返回非 JSON 响应：HTTP '+response.status);}
  if(!response.ok)throw Error(`${request.cfg.provider} HTTP ${response.status}: ${redact(j.error?.message||j.base_resp?.status_msg||'Request rejected',env)}`);
  try{return parseResponse(j,request.cfg);}catch(e){e.message=redact(e,env);throw e;}
 }
}
