// Emits one sanitized file at a time for the GitHub connector; never emits local data or .env.
import {readFile} from 'node:fs/promises';
import {checkRelease,releaseFiles} from './release-check.mjs';
const files=await releaseFiles();
if(process.argv[2]==='list'){console.log(JSON.stringify({check:await checkRelease(),files}));}
else{const file=process.argv[2];if(!files.includes(file))throw Error('File is outside release allowlist');const binary=file.endsWith('.png'),data=await readFile(file),content=data.toString(binary?'base64':'utf8'),offset=Number(process.argv[3])||0,limit=Number(process.argv[4])||16000;console.log(JSON.stringify({path:file,encoding:binary?'base64':'utf-8',total:content.length,offset,content:content.slice(offset,offset+limit)}));}
