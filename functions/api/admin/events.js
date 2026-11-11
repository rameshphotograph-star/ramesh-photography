import { json, error, readJson, text, isSameOriginRequest } from "../../_lib/http.js";
import { authenticateAdmin } from "../../_lib/auth.js";
import { randomToken } from "../../_lib/crypto.js";
function makeCode(type) {
  const prefix = ({ wedding:"WED", haldi:"HAL", reception:"REC", birthday:"BDY", other:"EVT" })[type] || "EVT";
  return prefix + "-" + randomToken(5).replace(/[-_]/g, "").slice(0, 6).toUpperCase();
}
export async function onRequestGet({ request, env }) {
  const admin = await authenticateAdmin(request, env);
  if (!admin) return error("Not signed in.", 401);
  const rows = await env.DB.prepare("SELECT e.id,e.event_name,e.event_type,e.event_date,e.venue,e.event_code,e.status,e.created_at,(SELECT COUNT(*) FROM photos p WHERE p.event_id=e.id) AS photo_count FROM events e WHERE e.admin_id=? ORDER BY e.created_at DESC").bind(admin.id).all();
  return json({ success: true, events: rows.results || [] });
}
export async function onRequestPost({ request, env }) {
  if (!isSameOriginRequest(request)) return error("Cross-origin request blocked.", 403);
  const admin = await authenticateAdmin(request, env);
  if (!admin) return error("Not signed in.", 401);
  try {
    const input = await readJson(request), eventName = text(input.eventName, 160);
    const eventType = text(input.eventType, 30).toLowerCase() || "wedding";
    const eventDate = text(input.eventDate, 20), venue = text(input.venue, 180);
    if (!eventName) return error("Event name is required.");
    if (!["wedding","haldi","reception","birthday","other"].includes(eventType)) return error("Invalid event type.");
    let eventCode = makeCode(eventType);
    for (let i=0;i<4;i++) {
      const exists = await env.DB.prepare("SELECT id FROM events WHERE event_code=?").bind(eventCode).first();
      if (!exists) break;
      eventCode = makeCode(eventType);
    }
    const result = await env.DB.prepare("INSERT INTO events (admin_id,event_name,event_type,event_date,venue,event_code,status) VALUES (?,?,?,?,?,?,'active')")
      .bind(admin.id,eventName,eventType,eventDate||null,venue||null,eventCode).run();
    return json({ success:true, event:{ id:result.meta.last_row_id,eventName,eventType,eventDate,venue,eventCode,status:"active" } },201);
  } catch (err) { return error(err.message || "Could not create event.",500); }
}
