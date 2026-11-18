const COOKIE="rp_crm_owner";
const enc=new TextEncoder();
function b64url(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
export function randomToken(){const b=new Uint8Array(32);crypto.getRandomValues(b);return b64url(b)}
export async function sha256(value){const h=await crypto.subtle.digest("SHA-256",enc.encode(value));return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
export async function passwordHash(password,salt){const material=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:enc.encode(salt),iterations:310000,hash:"SHA-256"},material,256);return [...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,"0")).join("")}
export function cookie(token){return COOKIE+"="+token+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200"}
export function clearCookie(){return COOKIE+"=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"}
export function getCookie(req){const raw=req.headers.get("Cookie")||"";const m=raw.split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="));return m?m.slice(COOKIE.length+1):""}
export function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}})}
export function sameOrigin(req){const origin=req.headers.get("Origin");return !origin||origin===new URL(req.url).origin}
export async function currentUser(req,env){if(!env.DB)return null;const token=getCookie(req);if(!token)return null;const hash=await sha256(token);return await env.DB.prepare("SELECT u.id,u.email,u.display_name,u.role FROM crm_sessions s JOIN crm_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>CURRENT_TIMESTAMP AND s.last_seen_at>=datetime('now','-12 hours') AND u.is_active=1 AND u.role='owner' AND lower(u.email)=lower(?) LIMIT 1").bind(hash,"rameshphotograph@gmail.com").first()}
