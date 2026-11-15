import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "../src/index.js";
const crypto=globalThis.crypto||webcrypto;
const uri="https://preoink.test";
const make=(path,method="GET",body,extra={})=>new Request(uri+path,{method,headers:{"origin":uri,"content-type":"application/json",...extra},body:body?JSON.stringify(body):undefined});
function database(){
 const data={users:[],sessions:[],loginAttempts:[],nextId:1};
 const DB={prepare(query){let vals=[];
 const statement={
   bind(...x){vals=x;return statement},
   async first(){
     if(query.startsWith("SELECT COUNT(*) AS n FROM login_attempts"))return {n:data.loginAttempts.filter(x=>x.email===vals[0]&&x.at>vals[1]).length};
     if(query.startsWith("SELECT id,email,role,active,salt,password_hash"))return data.users.find(x=>x.email===vals[0])||null;
     if(query.startsWith("SELECT u.id,u.email,u.role")){const sess=data.sessions.find(x=>x.hash===vals[0]&&x.expires>vals[1]);return sess?data.users.find(x=>x.id===sess.user_id&&x.active===1)&&({...data.users.find(x=>x.id===sess.user_id),token_hash:sess.hash}):null}
     throw Error("Unexpected DB first SQL "+query);
   },
   async all(){if(query.startsWith("SELECT id,email,role,active FROM users"))return {results:data.users.map(({id,email,role,active})=>({id,email,role,active}))};throw Error("Unexpected DB all SQL "+query)},
   async run(){
     if(query.startsWith("INSERT INTO login_attempts")){data.loginAttempts.push({email:vals[0],at:vals[1]});return {meta:{changes:1}}}
     if(query.startsWith("INSERT INTO sessions")){data.sessions.push({hash:vals[0],user_id:vals[1],expires:vals[3]});return {meta:{changes:1}}}
     if(query.startsWith("DELETE FROM sessions WHERE token_hash")){data.sessions=data.sessions.filter(x=>x.hash!==vals[0]);return {meta:{changes:1}}}
     if(query.startsWith("DELETE FROM sessions WHERE user_id")){data.sessions=data.sessions.filter(x=>x.user_id!==vals[0]);return {meta:{changes:1}}}
     if(query.startsWith("INSERT INTO users")){if(data.users.some(u=>u.email===vals[0]))throw Error("Unique");data.users.push({id:data.nextId++,email:vals[0],role:"tester",active:1,salt:vals[1],password_hash:vals[2],iterations:vals[3]});return {meta:{changes:1}}}
     if(query.startsWith("UPDATE users SET active")){const u=data.users.find(u=>u.id===vals[1]&&u.role==="tester");if(u){u.active=vals[0];return {meta:{changes:1}}}return {meta:{changes:0}}}
     throw Error("Unexpected DB run SQL "+query);
   }
 };return statement}
 };
 return {DB,data}
}
const fake={async get(key){if(key==="index.html")return {body:"<h1>Actual PreOink</h1>"};if(key==="straw.webp")return {body:new Uint8Array([1,2,3])};return null}};
function env(){const d=database();return {...d,GAME_FILES:fake}}
async function passHash(password,salt){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bytes=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:Uint8Array.from(Buffer.from(salt,"base64url")),iterations:210000},key,256);return Buffer.from(bytes).toString("base64url")}
async function addOwner(env,password="OwnerSecretPassword2026!"){const salt=Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url");env.data.users.push({id:env.data.nextId++,email:"owner@example.com",role:"admin",active:1,salt,password_hash:await passHash(password,salt),iterations:210000})}
async function login(env,email="owner@example.com",password="OwnerSecretPassword2026!"){return worker.fetch(make("/api/login","POST",{email,password}),env)}
function token(res){return res.headers.get("set-cookie")?.split(";")[0]}
test("anonymous visitors get login page, never real game HTML or images",async()=>{
 const e=env();
 assert.equal((await worker.fetch(make("/login"),e)).status,200);
 const root=await worker.fetch(make("/"),e);assert.equal(root.status,303);assert.equal(root.headers.get("location"),"/login");
 assert.equal((await worker.fetch(make("/play"),e)).status,303);
 assert.equal((await worker.fetch(make("/straw.webp"),e)).status,401);
 assert.equal((await worker.fetch(make("/game/straw.webp"),e)).status,401);
});
test("incorrect passwords cannot access game and an approved owner can",async()=>{
 const e=env();await addOwner(e);
 assert.equal((await login(e,"owner@example.com","WrongPassword1")).status,401);
 const r=await login(e);assert.equal(r.status,200);const cookie=token(r);assert.match(cookie,/preoink_session=/);
 const play=await worker.fetch(make("/play","GET",null,{cookie} ),e);
 assert.equal(play.status,200);assert.match(await play.text(),/Actual PreOink/);
 assert.equal((await worker.fetch(make("/game/straw.webp","GET",null,{cookie}),e)).status,200);
 assert.equal((await worker.fetch(make("/admin","GET",null,{cookie}),e)).status,200);
});
test("admin creates authorized tester; revoked tester immediately loses access",async()=>{
 const e=env();await addOwner(e);const ownerCookie=token(await login(e));
 const create=await worker.fetch(make("/api/admin/users","POST",{email:"tester@example.com"},{cookie:ownerCookie}),e);
 assert.equal(create.status,200);const d=await create.json();assert.ok(d.temporaryPassword);
 const testerLogin=await login(e,"tester@example.com",d.temporaryPassword);assert.equal(testerLogin.status,200);
 const testerCookie=token(testerLogin);
 assert.equal((await worker.fetch(make("/play","GET",null,{cookie:testerCookie}),e)).status,200);
 assert.equal((await worker.fetch(make("/admin","GET",null,{cookie:testerCookie}),e)).status,403);
 const revoke=await worker.fetch(make("/api/admin/toggle","POST",{id:e.data.users[1].id,active:false},{cookie:ownerCookie}),e);
 assert.equal(revoke.status,200);
 assert.equal((await worker.fetch(make("/game/straw.webp","GET",null,{cookie:testerCookie}),e)).status,401);
});
test("opening website root invalidates old session and forces password again",async()=>{
 const e=env();await addOwner(e);const cookie=token(await login(e));
 const res=await worker.fetch(make("/","GET",null,{cookie}),e);
 assert.equal(res.status,303);
 assert.equal((await worker.fetch(make("/play","GET",null,{cookie}),e)).status,303);
});
test("login and administration writes reject cross-origin requests",async()=>{
 const e=env();await addOwner(e);
 const noOrigin=new Request(uri+"/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:"owner@example.com",password:"OwnerSecretPassword2026!"})});
 assert.equal((await worker.fetch(noOrigin,e)).status,400);
});

test("Worker Static Assets are inaccessible anonymously and only fetched after login",async()=>{
 const e=env();delete e.GAME_FILES;
 const requested=[];
 e.ASSETS={async fetch(req){requested.push(new URL(req.url).pathname);const pathname=new URL(req.url).pathname;return new Response(pathname==="/index.html"?"<h1>Actual private Cinematic Edition</h1>":"private-bytes",{status:200,headers:{"content-type":"text/plain","cache-control":"public,max-age=999"}})}};
 for(const p of ["/play","/story.js","/game/straw.webp","/fonts/bungee-regular.ttf"]){
   const r=await worker.fetch(make(p),e);
   assert.ok(r.status===401||r.status===303,p);
 }
 assert.deepEqual(requested,[],"anonymous requests must never reach static asset binding");
 await addOwner(e);const cookie=token(await login(e));
 const play=await worker.fetch(make("/play","GET",null,{cookie}),e);
 assert.equal(play.status,200);
 assert.match(await play.text(),/Actual private Cinematic Edition/);
 assert.equal(play.headers.get("cache-control"),"private, no-store");
 const font=await worker.fetch(make("/fonts/bungee-regular.ttf","GET",null,{cookie}),e);
 assert.equal(font.status,200);
 assert.equal(font.headers.get("content-type"),"font/ttf");
 assert.deepEqual(requested,["/index.html","/fonts/bungee-regular.ttf"]);
});
