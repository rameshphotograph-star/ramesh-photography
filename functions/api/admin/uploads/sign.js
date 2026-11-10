import { json, error, readJson, text } from "../../../_lib/http.js";
import { authenticateAdmin } from "../../../_lib/auth.js";
import { createUploadPayload } from "../../../_lib/cloudinary.js";
const MAX_BYTES=100*1024*1024;
export async function onRequestPost({ request, env }) {
  const admin=await authenticateAdmin(request,env); if(!admin) return error("Not signed in.",401);
  try {
    const input=await readJson(request),eventId=Number(input.eventId),resourceType=text(input.resourceType,10);
    const fileName=text(input.fileName,180),contentType=text(input.contentType,100).toLowerCase(),fileSize=Number(input.fileSize);
    if(!Number.isInteger(eventId)||eventId<1) return error("Choose an event.");
    if(!["image","video"].includes(resourceType)) return error("Only images and videos are supported.");
    if(!(contentType.startsWith("image/")&&resourceType==="image")&&!(contentType.startsWith("video/")&&resourceType==="video")) return error("File type does not match the upload category.");
    if(!Number.isFinite(fileSize)||fileSize<1||fileSize>MAX_BYTES) return error("File must be smaller than 100 MB.");
    const event=await env.DB.prepare("SELECT event_code FROM events WHERE id=? AND admin_id=? AND status='active'").bind(eventId,admin.id).first();
    if(!event) return error("Event not found.",404);
    return json({success:true,eventId,fileName,contentType,fileSize,...await createUploadPayload(env,event.event_code,resourceType)});
  } catch(err) { return error(err.message||"Could not prepare upload.",500); }
}
