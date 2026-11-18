import {json,sameOrigin,passwordHash,randomToken,sha256,cookie} from "../../_lib/auth.js";
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return json({error:"Request origin not allowed"},403);
 if(!env.DB||!env.OWNER_SETUP_KEY)return json({error:"Owner setup is not configured yet"},503);
 let body;try{body=await request.json()}catch{return json({error:"Invalid request"},400)}
 const email=String(body.email||"").trim().toLowerCase(),name=String(body.name||"").trim().slice(0,80),password=String(body.password||""),setupKey=String(body.setupKey||"");
 if(email!=="rameshphotograph@gmail.com")return json({error:"This email is not allowed"},403);
 if(setupKey.trim()!==String(env.OWNER_SETUP_KEY).trim())return json({error:"Invalid setup key"},403);
 if(password.length<14)return json({error:"Use a password with at least 14 characters"},400);
 const exists=await env.DB.prepare("SELECT id FROM crm_users WHERE lower(email)=lower(?) LIMIT 1").bind(email).first();
 if(exists)return json({error:"Owner account already exists. Please sign in."},409);
 const id=crypto.randomUUID(),salt=randomToken(),hash=await passwordHash(password,salt);
 await env.DB.prepare("INSERT INTO crm_users(id,email,display_name,role,is_active) VALUES(?,?,?,'owner',1)").bind(id,email,name||"Ramesh Photography Owner").run();
 await env.DB.prepare("INSERT INTO crm_user_credentials(user_id,password_salt,password_hash) VALUES(?,?,?)").bind(id,salt,hash).run();
 return json({success:true,message:"Owner account created. Please sign in."},201);
}
