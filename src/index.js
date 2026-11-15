// PreOink Cinematic Edition secure game gateway.
// Game content stays in a PRIVATE Cloudflare R2 bucket. The public repository
// contains this Worker only. Every request requires a valid Cloudflare Access JWT.
const MIME = {
  html:"text/html; charset=utf-8", js:"application/javascript; charset=utf-8",
  css:"text/css; charset=utf-8", json:"application/json; charset=utf-8",
  svg:"image/svg+xml",webp:"image/webp",png:"image/png",
  jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",
  mp3:"audio/mpeg",ogg:"audio/ogg",wav:"audio/wav",
  ttf:"font/ttf",woff:"font/woff",woff2:"font/woff2"
};
const error=(status,text)=>new Response(text,{status,headers:{"cache-control":"no-store","content-type":"text/plain; charset=utf-8","x-content-type-options":"nosniff"}});
function decode(segment){
  let b=segment.replace(/-/g,"+").replace(/_/g,"/");
  b=b.padEnd(Math.ceil(b.length/4)*4,"=");
  return Uint8Array.from(atob(b),c=>c.charCodeAt(0));
}
const parse=segment=>JSON.parse(new TextDecoder().decode(decode(segment)));
async function verifyAccess(request,env) {
  const domain=env.ACCESS_TEAM_DOMAIN, aud=env.ACCESS_AUD;
  if(!domain||!aud||domain.includes("REPLACE_WITH")||aud.includes("REPLACE_WITH"))return false;
  let origin;
  try{
    const url=new URL(domain);
    if(url.protocol!=="https:"||url.pathname!=="/"||url.search||url.hash)return false;
    origin=url.origin;
  }catch{return false}
  const token=request.headers.get("Cf-Access-Jwt-Assertion");
  if(!token)return false;
  const parts=token.split(".");
  if(parts.length!==3)return false;
  try{
    const header=parse(parts[0]),payload=parse(parts[1]);
    const now=Math.floor(Date.now()/1000);
    if(header.alg!=="RS256"||!header.kid||payload.iss!==origin||
       !Array.isArray(payload.aud)||!payload.aud.includes(aud)||
       !Number.isFinite(payload.exp)||payload.exp<=now||
       (payload.nbf!==undefined&&(!Number.isFinite(payload.nbf)||payload.nbf>now)))return false;
    const response=await fetch(origin+"/cdn-cgi/access/certs");
    if(!response.ok)return false;
    const keys=(await response.json()).keys;
    const jwk=Array.isArray(keys)&&keys.find(k=>k.kid===header.kid&&k.kty==="RSA");
    if(!jwk)return false;
    const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decode(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
  }catch{return false}
}
export default {
  async fetch(request,env){
    if(request.method!=="GET"&&request.method!=="HEAD")return error(405,"Method not allowed");
    if(!await verifyAccess(request,env))return error(403,"Sign in through the authorized tester portal");
    if(!env.GAME_FILES)return error(503,"Private game storage not configured");
    let path;
    try{path=decodeURIComponent(new URL(request.url).pathname)}catch{return error(400,"Bad path")}
    if(path.includes("\\")||path.includes("\0")||path.split("/").includes(".."))return error(400,"Bad path");
    let key=path==="/"||path==="/play"?"index.html":path.replace(/^\/+/, "");
    if(!key||key.endsWith("/")||key.startsWith(".")||key.split("/").some(segment=>segment.startsWith(".")))return error(404,"Not found");
    const object=await env.GAME_FILES.get(key);
    if(!object)return error(404,"Game file not found");
    const ext=key.split(".").pop()?.toLowerCase()||"";
    const headers=new Headers({
      "content-type":MIME[ext]||"application/octet-stream",
      "cache-control":"private, no-store",
      "x-content-type-options":"nosniff",
      "referrer-policy":"no-referrer",
      "x-frame-options":"DENY"
    });
    // The actual imported game contains inline scripts and styles.
    // Keep this CSP compatible with existing source while restricting external connections.
    if(ext==="html")headers.set("content-security-policy",
      "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'");
    return new Response(request.method==="HEAD"?null:object.body,{status:200,headers});
  }
};