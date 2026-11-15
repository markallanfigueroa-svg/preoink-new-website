// Run locally with Node 22+: node tools/bootstrap-owner.mjs your-email@example.com
// Prompts privately for the owner's password. Outputs SQL to create the owner.
// The SQL is executed in Cloudflare D1 remotely by a trusted administrator.
// NEVER commit the output SQL or the password.
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { stdin, stdout, stderr } from "node:process";
const email=(process.argv[2]||"").trim().toLowerCase();
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254){stderr.write("Usage: node tools/bootstrap-owner.mjs owner@example.com\n");process.exit(1)}
if(!stdin.isTTY){stderr.write("Run in an interactive terminal; never pass passwords as arguments.\n");process.exit(1)}
stdout.write("Owner password (minimum 16 characters, input hidden): ");
let password="";
stdin.setRawMode(true);stdin.resume();stdin.setEncoding("utf8");
stdin.on("data",key=>{
 if(key==="\u0003"){stdin.setRawMode(false);process.exit(130)}
 if(key==="\r"||key==="\n"){
   stdin.setRawMode(false);stdin.pause();stdout.write("\n");
   if(password.length<16){stderr.write("Password too short. Minimum 16 characters.\n");process.exit(1)}
   const salt=randomBytes(16).toString("base64url");
   const hashed=pbkdf2Sync(password,Buffer.from(salt,"base64url"),210000,32,"sha256").toString("base64url");
   password="";
   const q=s=>"'"+s.replaceAll("'","''")+"'";
   stdout.write("-- Execute once using: npx wrangler d1 execute preoink-auth --remote --file=owner-seed.sql\n");
   stdout.write("-- Keep this file private and delete it after use.\n");
   stdout.write("INSERT INTO users(email,role,active,salt,password_hash,iterations) VALUES("+q(email)+",'admin',1,"+q(salt)+","+q(hashed)+",210000);\n");
 } else if(key==="\u007f") password=password.slice(0,-1);
 else if(key.length===1) password+=key;
});
