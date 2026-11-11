import { json, error, readJson, text, isSameOriginRequest } from "../../_lib/http.js";
import { authenticateAdmin } from "../../_lib/auth.js";
export async function onRequestGet({ request, env }) {
  const admin=await authenticateAdmin(request,env); if(!admin) return error("Not signed in.",401);
  const eventId=Number(new URL(request.url).searchParams.get("eventId"));
  if(!Number.isInteger(eventId)||eventId<1) return error("Choose an event.");
  const owned=await env.DB.prepare("SELECT id FROM events WHERE id=? AND admin_id=?").bind(eventId,admin.id).first();
  if(!owned) return error("Event not found.",404);
  const rows=await env.DB.prepare("SELECT p.id,p.event_id,p.album_id,p.file_name,p.content_type,p.file_size,p.uploaded_at,m.secure_url,m.resource_type,m.width,m.height,m.format FROM photos p LEFT JOIN photo_delivery_meta m ON m.photo_id=p.id WHERE p.event_id=? ORDER BY p.uploaded_at DESC").bind(eventId).all();
  return json({success:true,photos:rows.results||[]});
}
export async function onRequestPost({ request, env }) {
  if (!isSameOriginRequest(request)) return error("Cross-origin request blocked.", 403);
  const admin=await authenticateAdmin(request,env); if(!admin) return error("Not signed in.",401);
  try {
    const input=await readJson(request),eventId=Number(input.eventId),albumId=input.albumId?Number(input.albumId):null;
    const publicId=text(input.publicId,255),secureUrl=text(input.secureUrl,1200),fileName=text(input.fileName,180);
    const contentType=text(input.contentType,100),resourceType=text(input.resourceType,10),fileSize=Number(input.fileSize);
    const width=Number(input.width)||null,height=Number(input.height)||null,format=text(input.format,20)||null,duration=Number(input.duration)||null;
    if(!Number.isInteger(eventId)||eventId<1||!publicId||!secureUrl||!fileName) return error("Missing upload metadata.");
    if(!/^https:\/\/res\.cloudinary\.com\//.test(secureUrl)) return error("Invalid Cloudinary media URL.");
    if(!["image","video"].includes(resourceType)) return error("Invalid media type.");
    const owned=await env.DB.prepare("SELECT id FROM events WHERE id=? AND admin_id=? AND status='active'").bind(eventId,admin.id).first();
    if(!owned) return error("Event not found.",404);
    if(albumId) {
      const album=await env.DB.prepare("SELECT id FROM albums WHERE id=? AND event_id=?").bind(albumId,eventId).first();
      if(!album) return error("Album does not belong to this event.");
    }
    const inserted=await env.DB.prepare("INSERT INTO photos (event_id,album_id,object_key,file_name,content_type,file_size) VALUES (?,?,?,?,?,?)")
      .bind(eventId,albumId,publicId,fileName,contentType,Number.isFinite(fileSize)?fileSize:0).run();
    const photoId=inserted.meta.last_row_id;
    await env.DB.prepare("INSERT INTO photo_delivery_meta (photo_id,secure_url,resource_type,width,height,format,duration) VALUES (?,?,?,?,?,?,?)")
      .bind(photoId,secureUrl,resourceType,width,height,format,duration).run();
    return json({success:true,photo:{id:photoId,fileName,secureUrl,resourceType,albumId}},201);
  } catch(err) {
    if(String(err.message||"").includes("UNIQUE")) return error("This Cloudinary public ID has already been saved.",409);
    return error(err.message||"Could not save media details.",500);
  }
}
