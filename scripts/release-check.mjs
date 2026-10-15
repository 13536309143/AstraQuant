import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
export const rootFiles=['.env.example','.gitignore','.dockerignore','package.json','package-lock.json','README.md','README.zh-CN.md','CHANGELOG.md','CHANGELOG.zh-CN.md','Dockerfile','compose.yaml','server.mjs','启动股研助手.cmd','停止股研助手.cmd'];
export const sourceDirs=['lib','public','scripts','tests','docs','experiments','.github'];
export async function releaseFiles(){
 const files=[...rootFiles];async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+item.name;if(item.isDirectory()){if(!['__pycache__','.venv','node_modules'].includes(item.name))await walk(p);}else if(item.isFile())files.push(p);}}
 for(const d of sourceDirs)await walk(d);return files.sort();
}
export async function checkRelease(){
 const files=await releaseFiles(),secrets=[];
 try{const env=await readFile('.env','utf8');for(const line of env.split(/\r?\n/)){const m=line.match(/^\s*[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET)\s*=\s*["']?([^\r\n"']+)/);if(m&&m[1].trim().length>15)secrets.push(m[1].trim());}}catch{}
 let bytes=0;const findings=[];
 for(const file of files){const data=await readFile(file);bytes+=data.length;if(/(?:^|\/)(data|logs|node_modules|\.publish)\//.test(file)||(/(?:^|\/)\.env/.test(file)&&file!=='.env.example'))findings.push(file+': private path');
  const text=data.toString('utf8');if(secrets.some(key=>text.includes(key)))findings.push(file+': configured secret found');
  if(/sk-(?:cp-|ant-)?[A-Za-z0-9_-]{25,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AIza[A-Za-z0-9_-]{30,}/.test(text))findings.push(file+': credential-like token');
  if(/\.(md|html|js|mjs|json|yaml|yml|svg|css)$/.test(file)&&text.includes('\uFFFD'))findings.push(file+': invalid UTF-8 replacement character');
 }
 // Verify local relative Markdown references, including images.
 for(const file of files.filter(f=>f.endsWith('.md'))){const text=await readFile(file,'utf8');for(const m of text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)){const target=m[1];if(/^(?:https?:|#|mailto:)/.test(target))continue;const name=target.split('#')[0];if(!name)continue;try{await stat(path.resolve(path.dirname(file),decodeURIComponent(name)));}catch{findings.push(file+': missing link '+name);}}}
 if(findings.length)throw Error(findings.join('\n'));
 return {ok:true,files:files.length,bytes,privatePathsExcluded:true,configuredSecretsAbsent:true};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/release-check.mjs'))console.log(JSON.stringify(await checkRelease()));
