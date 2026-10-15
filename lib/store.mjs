import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
mkdirSync('data',{recursive:true});
const db=new DatabaseSync('data/stock.db');
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, created TEXT, updated TEXT, status TEXT, symbol TEXT, body TEXT); CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);');
export function saveJob(j){db.prepare('INSERT OR REPLACE INTO jobs VALUES (?,?,?,?,?,?)').run(j.id,j.created,j.updated,j.status,j.symbol,JSON.stringify(j));}
export function getJob(id){const r=db.prepare('SELECT body FROM jobs WHERE id=?').get(id);return r?JSON.parse(r.body):null;}
export function listJobs(){return db.prepare('SELECT id,created,updated,status,symbol FROM jobs ORDER BY created DESC LIMIT 80').all();}
export function getSetting(k,fallback){const r=db.prepare('SELECT value FROM settings WHERE key=?').get(k);return r?JSON.parse(r.value):fallback;}
export function setSetting(k,v){db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run(k,JSON.stringify(v));return v;}
export function recoverJobs(){for(const row of db.prepare("SELECT body FROM jobs WHERE status IN ('queued','running')").all()){const j=JSON.parse(row.body);j.status='interrupted';j.error='服务重启中断了任务，可重新创建分析';j.updated=new Date().toISOString();saveJob(j);}}
