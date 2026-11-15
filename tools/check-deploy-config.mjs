// Prevent a deployment that cannot connect to the owner's D1 database.
// This runs before publishing; it never needs Cloudflare credentials.
import {readFileSync} from 'node:fs';
const config=readFileSync(new URL('../wrangler.toml',import.meta.url),'utf8');
const id=config.match(/^database_id\s*=\s*"([^"]+)"/m)?.[1];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if(!id||!uuid.test(id)){
  console.error('STOP: wrangler.toml has no real D1 database_id. Open Cloudflare D1 > preoink-auth, copy the database UUID (or use wrangler d1 list), and update wrangler.toml before deployment.');
  process.exitCode=1;
}else{
  console.log('D1 database ID is formatted correctly. This does not verify database access, migrations, or live deployment.');
}
