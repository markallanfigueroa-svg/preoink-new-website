#!/usr/bin/env node
// Usage: node tools/upload-game-to-private-r2.mjs /path/to/PreOink-Cinematic-Edition/preoink/dist
// MUST run from an owner-authenticated workstation with Wrangler authorized.
// This helper never copies the private game into the public GitHub repository.
import { readdir, stat, readFile } from "node:fs/promises";
import { resolve, relative, sep, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const dist=resolve(process.argv[2]||"");
if(process.argv.length!==3){console.error("Usage: node tools/upload-game-to-private-r2.mjs /absolute/path/to/private-game/preoink/dist");process.exit(2)}
async function walk(dir){
 const output=[];
 for(const ent of await readdir(dir,{withFileTypes:true})){
  if(ent.name.startsWith(".") || ent.isSymbolicLink())throw Error("Hidden files and symlinks are not accepted: "+ent.name);
  const p=join(dir,ent.name);
  if(ent.isDirectory())output.push(...await walk(p));
  else if(ent.isFile())output.push(p);
 }
 return output;
}
try{
 const files=(await walk(dist)).sort();
 const required=["index.html","story.js"];
 for(const f of required)if(!files.includes(join(dist,f)))throw Error("Missing required game file: "+f);
 if(files.length<10)throw Error("Only "+files.length+" files found: refusing to replace actual game with partial upload");
 let build="unknown";
 const html=await readFile(join(dist,"index.html"),"utf8");
 build=html.match(/<meta name="preoink-build" content="([^"]+)"/)?.[1]||"unidentified";
 console.log("Source build:",build,"Files:",files.length);
 const digest=createHash("sha256");
 for(const file of files){
  const key=relative(dist,file).split(sep).join("/");
  if(key.includes("..")||key.startsWith("/"))throw Error("Unsafe key: "+key);
  const data=await readFile(file);
  digest.update(key);digest.update(data);
 }
 const checksum=digest.digest("hex");
 console.log("Upload checksum:",checksum);
 if(process.env.CONFIRM_PRIVATE_R2!=="YES"){
  console.log("DRY RUN ONLY. Upload requires CONFIRM_PRIVATE_R2=YES and an owner-authenticated wrangler session.");
  console.log("Before upload: verify R2 bucket is PRIVATE, its public domain and r2.dev URL are disabled, and the Worker is not yet shared.");
  process.exit(0);
 }
 const check=spawnSync("npx",["wrangler","whoami"],{stdio:"inherit"});
 if(check.status!==0)throw Error("Wrangler account authorization is not ready");
 let count=0;
 for(const file of files){
  const key=relative(dist,file).split(sep).join("/");
  const result=spawnSync("npx",["wrangler","r2","object","put","preoink-private-game/"+key,"--file",file,"--remote"],{stdio:"inherit"});
  if(result.status!==0)throw Error("Upload failed at "+key+" after "+count+" files. Do NOT publish partial game.");
  count++;
 }
 console.log("UPLOADED",count,"files to PRIVATE R2. Build:",build,"Checksum:",checksum);
 console.log("NEXT: verify all game assets and authorization in a real browser before publishing.");
}catch(error){console.error("FAILED:",error.message);process.exit(1)}
