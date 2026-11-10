import { json, error, text } from "../_lib/http.js";
export async function onRequestGet({ request, env }) {
  try {
    const code=text(new URL(request.url).searchParams.get("code"),40).toUpperCase();
    if(!code) return error("Enter an event code.");
    const event=await env.DB.prepare("SELECT id,event_name,event_type,event_date,venue,event_code FROM events WHERE event_code=? AND status='active' LIMIT 1").bind(code).first();
    if(!event) return error("Event code not found or the gallery is not available.",404);
    const rows=await env.DB.prepare("SELECT p.id,p.album_id,p.file_name,p.content_type,p.file_size,p.uploaded_at,m.secure_url,m.resource_type,m.width,m.height,m.format,a.album_name FROM photos p LEFT JOIN photo_delivery_meta m ON m.photo_id=p.id LEFT JOIN albums a ON a.id=p.album_id WHERE p.event_id=? AND m.secure_url IS NOT NULL ORDER BY p.uploaded_at DESC").bind(event.id).all();
    return json({success:true,event,photos:rows.results||[]});
  } catch { return error("Gallery service is not ready. Please contact the photographer.",500); }
}
