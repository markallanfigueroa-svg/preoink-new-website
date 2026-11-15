// Actual PreOink Cinematic Edition remains in a PRIVATE R2 bucket.
// This Worker serves no game bytes until D1 username/password auth succeeds.
const te=new TextEncoder();
const MIME={html:"text/html; charset=utf-8",js:"application/javascript; charset=utf-8",css:"text/css; charset=utf-8",json:"application/json; charset=utf-8",svg:"image/svg+xml",webp:"image/webp",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",mp3:"audio/mpeg",ogg:"audio/ogg",wav:"audio/wav",ttf:"font/ttf",woff:"font/woff",woff2:"font/woff2"};
const COOKIE="preoink_session",SESSION_SECONDS=3600*3,ITER=210000;
const ENC=new TextEncoder();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const un64=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0));
const rand=n=>crypto.getRandomValues(new Uint8Array(n));
const digest=async s=>b64(await crypto.subtle.digest("SHA-256",ENC.encode(s)));
const iso=()=>Math.floor(Date.now()/1000);
const text=(msg,status=200)=>new Response(msg,{status,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...headers}});
const page=(title,body,status=200,headers={})=>new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${title}</title><style>html{font-family:system-ui;background:#161522;color:#fff}body{max-width:560px;margin:8vh auto;padding:16px}h1{color:#ffc46b}input,button{box-sizing:border-box;display:block;width:100%;padding:14px;margin:10px 0;font-size:16px;border-radius:8px}button{background:#fbbf65;border:0;font-weight:800;cursor:pointer}.sub{font-size:14px;color:#bac0cb}a{color:#ffca80}section{background:#242333;padding:22px;border-radius:16px}#note{min-height:24px}</style></head><body><section>${body}</section></body></html>`,{status,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","content-security-policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'","x-content-type-options":"nosniff","x-frame-options":"DENY",...headers}});
const loginHtml=()=>page("PreOink Private Playtest",`<h1>PreOink Cinematic Edition</h1><p>Private playtest · authorized testers only</p><form id="f"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button>Sign in and play</button></form><p id="note" role="alert"></p><p class="sub">Accounts are created by the playtest administrator. No public signups.</p><script>document.querySelector("#f").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const n=document.querySelector("#note");n.textContent="Signing in…";try{const r=await fetch("/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(f))});if(!r.ok){n.textContent="Incorrect credentials or account not approved";return;}location.replace("/play");}catch{n.textContent="Connection error. Try again."}};</script>`);
const cookieHeader=(value,expire=false)=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict${expire?"; Max-Age=0":""}`;
function getCookie(request){const cookies=request.headers.get("cookie")||"";const match=cookies.match(/(?:^|;\s*)preoink_session=([A-Za-z0-9_-]{43})/);return match?.[1]||null}
async function derive(pass,salt,iterations=ITER){const key=await crypto.subtle.importKey("raw",ENC.encode(pass),"PBKDF2",false,["deriveBits"]);return b64(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:un64(salt),iterations},key,256))}
async function check(pass,user){if(!user||!user.salt||!user.password_hash||user.iterations<100000)return false;const hashed=await derive(pass,user.salt,user.iterations);const a=ENC.encode(hashed),b=ENC.encode(user.password_hash);if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0}
async function issue(request,env,user){const token=b64(rand(32)),hash=await digest(token);const now=iso();await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)").bind(hash,user.id,now,now+SESSION_SECONDS).run();return json({ok:true,role:user.role},200,{"set-cookie":cookieHeader(token)})}
async function auth(request,env){const token=getCookie(request);if(!token)return null;const hash=await digest(token);return env.DB.prepare("SELECT u.id,u.email,u.role,u.active,s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1").bind(hash,iso()).first()}
function sameOrigin(request){const o=request.headers.get("origin");if(!o)return false;try{return new URL(o).origin===new URL(request.url).origin}catch{return false}}
function secureName(path){let p;try{p=decodeURIComponent(path)}catch{return null}if(p.includes("\\")||p.includes("\0")||p.split("/").includes("..")||p.split("/").some(s=>s.startsWith(".")&&s))return null;if(p==="/"||p==="/play")return "index.html";if(p==="/game"||p==="/game/")return "index.html";if(p.startsWith("/game/"))p=p.slice(6);else p=p.slice(1);if(!p||p.endsWith("/")||!/^[-\w/ .]+$/.test(p))return null;return p}
async function post(request){if((request.headers.get("content-type")||"").split(";")[0]!=="application/json"||!sameOrigin(request))return null;const length=Number(request.headers.get("content-length")||0);if(length>2048)return null;let body;try{body=await request.json()}catch{return null};return body&&typeof body==="object"&&!Array.isArray(body)?body:null}
const adminHtml=()=>page("PreOink Tester Admin",`<h1>Tester administration</h1><p class="sub">Owner-only accounts. Generate a temporary password, then give it directly to your tester.</p><form id="add"><label>Tester email<input name="email" type="email" required></label><button>Create tester account</button></form><p id="result" role="status"></p><button id="refresh" type="button">Refresh testers</button><div id="testers"></div><button id="out" type="button">Sign out</button><script>const note=document.querySelector("#result"),list=document.querySelector("#testers");const req=(url,body)=>fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const safe=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));async function refresh(){const r=await fetch("/api/admin/users");if(!r.ok){note.textContent="Not authorized";return}const d=await r.json();list.replaceChildren();for(const u of d.users){const p=document.createElement("p");p.textContent=u.email+" · "+u.role+" · "+(u.active?"Active":"Disabled")+" ";if(u.role!=="admin"){const b=document.createElement("button");b.textContent=u.active?"Revoke":"Reactivate";b.onclick=async()=>{const r=await req("/api/admin/toggle",{id:u.id,active:!u.active});if(r.ok)refresh();else note.textContent="Action failed"};p.appendChild(b)}list.appendChild(p)}}document.querySelector("#add").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const r=await req("/api/admin/users",{email:f.get("email")});const d=await r.json();note.textContent=r.ok?"Temporary password for "+f.get("email")+": "+d.temporaryPassword+" (copy it now; it will not display again)":(d.error||"Could not create tester");if(r.ok)refresh()};document.querySelector("#refresh").onclick=refresh;document.querySelector("#out").onclick=async()=>{await req("/api/logout",{});location.replace("/login")};refresh();</script>`);
export default {async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(!env.DB)return text("Auth database not configured",503);
  // Visiting the public site root always begins a fresh sign-in, even when
  // a previous three-hour browser session is still present.
  if(request.method==="GET"&&path==="/"){
    const old=getCookie(request);
    if(old){await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digest(old)).run();}
    return new Response(null,{status:303,headers:{"location":"/login","cache-control":"no-store","set-cookie":cookieHeader("",true)}});
  }
  if(request.method==="GET"&&path==="/login")return loginHtml();
  if(request.method==="POST"&&path==="/api/login"){
    const body=await post(request);if(!body||typeof body.email!=="string"||typeof body.password!=="string")return json({error:"Invalid request"},400);
    const email=body.email.trim().toLowerCase();if(email.length>254||body.password.length>256||body.password.length<8)return json({error:"Invalid credentials"},401);
    const now=iso();const recent=await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE email=? AND attempted_at>?").bind(email,now-900).first();
    if(recent?.n>=8)return json({error:"Try again later"},429);
    const user=await env.DB.prepare("SELECT id,email,role,active,salt,password_hash,iterations FROM users WHERE email=?").bind(email).first();
    const valid=user&&user.active===1&&await check(body.password,user);
    if(!valid){await env.DB.prepare("INSERT INTO login_attempts(email,attempted_at) VALUES(?,?)").bind(email,now).run();return json({error:"Invalid credentials"},401)}
    return issue(request,env,user);
  }
  const user=await auth(request,env);
  if(!user){
    if((path==="/"||path==="/play")&&request.method==="GET")return new Response(null,{status:303,headers:{location:"/login","cache-control":"no-store"}});
    return json({error:"Sign in required"},401);
  }
  if(request.method==="POST"&&path==="/api/logout"){
    if(!await post(request))return json({error:"Bad request"},400);
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(user.token_hash).run();
    return json({ok:true},200,{"set-cookie":cookieHeader("",true)});
  }
  if(request.method==="GET"&&path==="/admin"){if(user.role!=="admin")return text("Forbidden",403);return adminHtml()}
  if(path.startsWith("/api/admin/")){
    if(user.role!=="admin")return json({error:"Forbidden"},403);
    if(path==="/api/admin/users"&&request.method==="GET"){
      const r=await env.DB.prepare("SELECT id,email,role,active FROM users ORDER BY email").all();
      return json({users:r.results||[]});
    }
    if(request.method!=="POST")return json({error:"Method not allowed"},405);
    const body=await post(request);if(!body)return json({error:"Invalid request"},400);
    if(path==="/api/admin/users"){
      if(typeof body.email!=="string")return json({error:"Invalid email"},400);
      const email=body.email.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json({error:"Invalid email"},400);
      const password=b64(rand(24)),salt=b64(rand(16)),hash=await derive(password,salt);
      try{await env.DB.prepare("INSERT INTO users(email,role,active,salt,password_hash,iterations) VALUES(?,'tester',1,?,?,?)").bind(email,salt,hash,ITER).run();return json({ok:true,temporaryPassword:password})}
      catch{return json({error:"Account already exists or database failure"},409)}
    }
    if(path==="/api/admin/toggle"){
      if(!Number.isInteger(body.id)||typeof body.active!=="boolean")return json({error:"Invalid request"},400);
      const result=await env.DB.prepare("UPDATE users SET active=? WHERE id=? AND role='tester'").bind(body.active?1:0,body.id).run();
      if(!body.active)await env.DB.prepare("DELETE FROM sessions WHERE user_id=? AND user_id IN (SELECT id FROM users WHERE role='tester')").bind(body.id).run();
      return json({ok:(result.meta?.changes||0)>0});
    }
    return json({error:"Not found"},404);
  }
  if(path==="/api/me"&&request.method==="GET")return json({email:user.email,role:user.role});
  if(path.startsWith("/api/"))return json({error:"Not found"},404);
  if(request.method!=="GET"&&request.method!=="HEAD")return text("Method not allowed",405);
  if(!env.GAME_FILES)return text("Private game storage not configured",503);
  const key=secureName(path);if(!key)return text("Not found",404);
  const obj=await env.GAME_FILES.get(key);if(!obj)return text("Game file not found",404);
  const ext=key.split(".").pop().toLowerCase();
  const headers=new Headers({"content-type":MIME[ext]||"application/octet-stream","cache-control":"private, no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer","x-frame-options":"DENY"});
  if(ext==="html")headers.set("content-security-policy","default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; media-src 'self' blob: data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'");
  return new Response(request.method==="HEAD"?null:obj.body,{status:200,headers});
}};
