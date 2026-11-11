import { json, error, readJson, text, isSameOriginRequest } from "../../_lib/http.js";
import { authenticateAdmin } from "../../_lib/auth.js";
export async function onRequestGet({ request, env }) {
  const admin=await authenticateAdmin(request,env); if(!admin) return error("Not signed in.",401);
  const eventId=Number(new URL(request.url).searchParams.get("eventId"));
  if(!Number.isInteger(eventId)||eventId<1) return error("Choose an event.");
  const owned=await env.DB.prepare("SELECT id FROM events WHERE id=? AND admin_id=?").bind(eventId,admin.id).first();
  if(!owned) return error("Event not found.",404);
  const rows=await env.DB.prepare("SELECT id,event_id,album_name,created_at FROM albums WHERE event_id=? ORDER BY created_at DESC").bind(eventId).all();
  return json({success:true,albums:rows.results||[]});
}
export async function onRequestPost({ request, env }) {
  if (!isSameOriginRequest(request)) return error("Cross-origin request blocked.", 403);
  const admin=await authenticateAdmin(request,env); if(!admin) return error("Not signed in.",401);
  try {
    const input=await readJson(request),eventId=Number(input.eventId),albumName=text(input.albumName,100);
    if(!Number.isInteger(eventId)||eventId<1||!albumName) return error("Choose an event and enter an album name.");
    const owned=await env.DB.prepare("SELECT id FROM events WHERE id=? AND admin_id=? AND status='active'").bind(eventId,admin.id).first();
    if(!owned) return error("Event not found.",404);
    const result=await env.DB.prepare("INSERT INTO albums (event_id,album_name) VALUES (?,?)").bind(eventId,albumName).run();
    return json({success:true,album:{id:result.meta.last_row_id,event_id:eventId,album_name:albumName}},201);
  } catch(err) { return error(err.message||"Could not create album.",500); }
}
