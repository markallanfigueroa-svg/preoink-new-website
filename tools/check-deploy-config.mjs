// Offline deployment configuration checks. This never connects to Cloudflare,
// creates storage, publishes files, or enables billing.
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const config=readFileSync(resolve(root,'wrangler.toml'),'utf8');
const errors=[];
const value=(key,section)=>section.match(new RegExp('^'+key+'\\s*=\\s*"([^"]+)"','m'))?.[1];
const d1=config.match(/\[\[d1_databases\]\]([\s\S]*?)(?=\n\[\[|$)/)?.[1]||'';
const r2=config.match(/\[\[r2_buckets\]\]([\s\S]*?)(?=\n\[\[|$)/)?.[1]||'';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if(value('binding',d1)!=='DB')errors.push('D1 must bind as DB.');
if(value('database_name',d1)!=='preoink-auth')errors.push('Unexpected D1 database name.');
if(!uuid.test(value('database_id',d1)||''))errors.push('D1 database_id must be a real UUID.');
if(value('migrations_dir',d1)!=='migrations'||!existsSync(resolve(root,'migrations/0001_auth.sql')))errors.push('D1 migration missing.');
if(value('binding',r2)!=='GAME_FILES'||value('bucket_name',r2)!=='preoink-private-game')errors.push('Private R2 binding must be GAME_FILES -> preoink-private-game.');
if(/preview_bucket_name\s*=|public_bucket\s*=/.test(r2))errors.push('Unexpected R2 preview/public bucket setting.');
if(value('main',config)!=='src/index.js'||!existsSync(resolve(root,'src/index.js')))errors.push('Worker entrypoint missing.');
for(const path of ['preoink/dist','public/game','game-assets']){
  if(existsSync(resolve(root,path)))errors.push('Private game assets must not be committed to this public gateway: '+path);
}
if(errors.length){
  for(const error of errors)console.error('STOP: '+error);
  process.exitCode=1;
}else{
  console.log('Local deployment configuration checks passed. This does NOT verify Cloudflare resources, owner account, R2 billing, or live game deployment.');
}
