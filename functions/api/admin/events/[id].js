import { json, error, readJson, text, isSameOriginRequest } from "../../../_lib/http.js";
import { authenticateAdmin } from "../../../_lib/auth.js";
export async function onRequestPatch({ request, env, params }) {
  if (!isSameOriginRequest(request)) return error("Cross-origin request blocked.", 403);
  const admin = await authenticateAdmin(request, env);
  if (!admin) return error("Not signed in.",401);
  const id = Number(params.id);
  if (!Number.isInteger(id)||id<1) return error("Invalid event.");
  try {
    const input = await readJson(request), name = text(input.eventName,160), date = text(input.eventDate,20), venue = text(input.venue,180);
    const result = await env.DB.prepare("UPDATE events SET event_name=COALESCE(?,event_name),event_date=?,venue=? WHERE id=? AND admin_id=?")
      .bind(name||null,date||null,venue||null,id,admin.id).run();
    if (!result.meta||result.meta.changes!==1) return error("Event not found.",404);
    return json({success:true});
  } catch(err) { return error(err.message||"Could not update event.",500); }
}
export async function onRequestDelete({ request, env, params }) {
  if (!isSameOriginRequest(request)) return error("Cross-origin request blocked.", 403);
  const admin = await authenticateAdmin(request, env);
  if (!admin) return error("Not signed in.",401);
  const id=Number(params.id);
  if (!Number.isInteger(id)||id<1) return error("Invalid event.");
  const result=await env.DB.prepare("UPDATE events SET status='archived' WHERE id=? AND admin_id=?").bind(id,admin.id).run();
  if (!result.meta||result.meta.changes!==1) return error("Event not found.",404);
  return json({success:true,message:"Event archived. Existing media was preserved."});
}
