import test from 'node:test';
import assert from 'node:assert/strict';
import {PROVIDERS,resolveConfig,buildRequest,parseResponse,callProvider,redact} from '../lib/providers.mjs';
const messages=[{role:'system',content:'Evidence only'},{role:'user',content:'Analyze'}];
test('every provider builds an isolated credential request',()=>{
 for(const provider of Object.keys(PROVIDERS)){
  const prefix=provider.toUpperCase(),env={LLM_PROVIDER:provider,[prefix+'_API_KEY']:'secret-example-not-real',[prefix+'_MODEL']:'test-model'};
  if(provider==='azure')env.AZURE_BASE_URL='https://example.openai.azure.com';
  if(provider==='custom')env.CUSTOM_BASE_URL='https://example.org/v1';
  const req=buildRequest(messages,{env,maxTokens:123});assert.equal(req.cfg.provider,provider);assert.ok(req.url);assert.equal(JSON.stringify(req.cfg).includes('secret-example'),false);
  if(provider==='anthropic'){assert.equal(req.headers['x-api-key'],env.ANTHROPIC_API_KEY);assert.equal(req.body.system,'Evidence only');assert.equal(req.body.messages.length,1);}
  if(provider==='gemini'){assert.equal(req.headers['x-goog-api-key'],env.GEMINI_API_KEY);assert.equal(req.body.contents[0].role,'user');}
  if(provider==='openai'){assert.equal(req.body.store,false);assert.equal(req.body.max_output_tokens,123);assert.equal(req.body.temperature,undefined);}
 }
});
test('role routing selects a separate provider key and model',()=>{
 const env={MINIMAX_API_KEY:'default-secret',AGENT_RISK_PROVIDER:'openai',AGENT_RISK_MODEL:'risk-model',OPENAI_API_KEY:'risk-secret'};
 const req=buildRequest(messages,{role:'risk',env});assert.equal(req.cfg.model,'risk-model');assert.equal(req.headers.Authorization,'Bearer risk-secret');assert.equal(resolveConfig('',env).provider,'minimax');
});
test('official keys cannot be redirected to an arbitrary gateway',()=>{
 assert.throws(()=>buildRequest(messages,{env:{OPENAI_API_KEY:'test-key',LLM_PROVIDER:'openai',OPENAI_MODEL:'test',OPENAI_BASE_URL:'https://evil.invalid/v1'}}),/Untrusted/);
 assert.throws(()=>buildRequest(messages,{env:{LLM_PROVIDER:'ollama',OLLAMA_MODEL:'test',OLLAMA_BASE_URL:'http://192.168.1.1/v1'}}),/Local network/);
 assert.throws(()=>buildRequest(messages,{env:{LLM_PROVIDER:'custom',CUSTOM_API_KEY:'test',CUSTOM_MODEL:'test',CUSTOM_BASE_URL:'https://example.com/v1?key=hidden'}}),/query/);
});
test('native protocol response normalization excludes hidden reasoning',()=>{
 const cases=[
  ['openai',{output:[{type:'reasoning',content:[{text:'secret'}]},{type:'message',content:[{type:'output_text',text:'result'}]}],usage:{input_tokens:11,output_tokens:3}}],
  ['anthropic',{content:[{type:'thinking',thinking:'secret'},{type:'text',text:'result'}],usage:{input_tokens:11,output_tokens:3}}],
  ['gemini',{candidates:[{content:{parts:[{thought:true,text:'secret'},{text:'result'}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:11,candidatesTokenCount:3,totalTokenCount:14}}],
  ['minimax',{choices:[{message:{content:'<think>secret</think>result'},finish_reason:'stop'}],usage:{prompt_tokens:11,completion_tokens:3,total_tokens:14}}]
 ];
 for(const [provider,j] of cases){const r=parseResponse(j,{provider,protocol:PROVIDERS[provider].protocol,model:'model'});assert.equal(r.content,'result');assert.equal(r.usage.total_tokens,14);}
 assert.throws(()=>parseResponse({status:'incomplete',output:[],usage:{input_tokens:1}},{protocol:'responses'}),/未完成/);
});
test('mocked end-to-end request redacts provider errors',async()=>{
 const env={LLM_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'custom-private-example'};
 await assert.rejects(callProvider(messages,{env,fetchImpl:async()=>({ok:false,status:401,json:async()=>({error:{message:'bad '+env.DEEPSEEK_API_KEY}})})}),e=>!e.message.includes(env.DEEPSEEK_API_KEY)&&e.message.includes('[REDACTED]'));
 assert.equal(redact('API custom-private-example',env),'API [REDACTED]');
});
