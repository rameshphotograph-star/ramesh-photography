import { json, error, text } from "../_lib/http.js";

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const code = text(url.searchParams.get("code"), 40).toUpperCase();
    if (!code) return error("Enter an event code.");

    const event = await env.DB.prepare(
      "SELECT id,event_name,event_type,event_date,venue,event_code FROM events WHERE event_code=? AND status='active' LIMIT 1"
    ).bind(code).first();
    if (!event) return error("Event code not found or the gallery is not available.", 404);

    const limit = Math.min(60, Math.max(12, Number(url.searchParams.get("limit")) || 60));
    const cursor = Number(url.searchParams.get("cursor")) || 0;
    const albumId = Number(url.searchParams.get("albumId")) || 0;
    if (albumId) {
      const album = await env.DB.prepare("SELECT id FROM albums WHERE id=? AND event_id=?").bind(albumId, event.id).first();
      if (!album) return error("Album not found for this event.", 404);
    }

    let sql = "SELECT p.id,p.album_id,p.file_name,p.content_type,p.file_size,p.uploaded_at,m.secure_url,m.resource_type,m.width,m.height,m.format,a.album_name FROM photos p JOIN photo_delivery_meta m ON m.photo_id=p.id LEFT JOIN albums a ON a.id=p.album_id WHERE p.event_id=?";
    const bindings = [event.id];
    if (albumId) { sql += " AND p.album_id=?"; bindings.push(albumId); }
    if (cursor > 0) { sql += " AND p.id<?"; bindings.push(cursor); }
    sql += " ORDER BY p.id DESC LIMIT ?";
    bindings.push(limit);
    const rows = await env.DB.prepare(sql).bind(...bindings).all();
    const photos = rows.results || [];
    const nextCursor = photos.length === limit ? photos[photos.length - 1].id : null;
    const albums = await env.DB.prepare("SELECT id,album_name FROM albums WHERE event_id=? ORDER BY album_name").bind(event.id).all();

    return json({ success: true, event, albums: albums.results || [], photos, nextCursor });
  } catch {
    return error("Gallery service is not ready. Please contact the photographer.", 500);
  }
}
