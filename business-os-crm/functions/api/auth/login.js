import {json,sameOrigin,passwordHash,randomToken,sha256,cookie} from "../../_lib/auth.js";
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return json({error:"Request origin not allowed"},403);
 if(!env.DB)return json({error:"Database unavailable"},503);
 let body;try{body=await request.json()}catch{return json({error:"Invalid request"},400)}
 const email=String(body.email||"").trim().toLowerCase(),password=String(body.password||"");
 if(email!=="rameshphotograph@gmail.com"||!password)return json({error:"Invalid email or password"},401);
 const ip=(request.headers.get("CF-Connecting-IP")||"unknown"),ipHash=await sha256(ip);
 const attempts=await env.DB.prepare("SELECT COUNT(*) AS n FROM crm_login_attempts WHERE ip_hash=? AND attempted_at>=datetime('now','-15 minutes')").bind(ipHash).first();
 if(Number(attempts?.n||0)>=8)return json({error:"Too many attempts. Try again in 15 minutes."},429);
 const row=await env.DB.prepare("SELECT u.id,u.email,u.display_name,c.password_salt,c.password_hash FROM crm_users u JOIN crm_user_credentials c ON c.user_id=u.id WHERE lower(u.email)=? AND u.role='owner' AND u.is_active=1 LIMIT 1").bind(email).first();
 if(!row||await passwordHash(password,row.password_salt)!==row.password_hash){
  await env.DB.prepare("INSERT INTO crm_login_attempts(ip_hash) VALUES(?)").bind(ipHash).run();
  return json({error:"Invalid email or password"},401);
 }
 await env.DB.prepare("DELETE FROM crm_login_attempts WHERE ip_hash=?").bind(ipHash).run();
 const token=randomToken(),tokenHash=await sha256(token),sessionId=crypto.randomUUID();
 await env.DB.prepare("DELETE FROM crm_sessions WHERE expires_at<=CURRENT_TIMESTAMP").run();
 await env.DB.prepare("INSERT INTO crm_sessions(id,user_id,token_hash,expires_at,last_seen_at) VALUES(?,?,?,datetime('now','+12 hours'),CURRENT_TIMESTAMP)").bind(sessionId,row.id,tokenHash).run();
 return json({success:true,user:{id:row.id,email:row.email,name:row.display_name}},200,{"set-cookie":cookie(token)});
}
