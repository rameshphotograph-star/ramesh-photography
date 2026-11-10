const encoder = new TextEncoder();
function hex(bytes) { return Array.from(new Uint8Array(bytes), v => v.toString(16).padStart(2, "0")).join(""); }
export async function cloudinarySignature(params, apiSecret) {
  const canonical = Object.keys(params).sort().filter(key => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .map(key => key + "=" + params[key]).join("&") + apiSecret;
  return hex(await crypto.subtle.digest("SHA-1", encoder.encode(canonical)));
}
export function cloudinaryConfig(env) {
  const cloudName = env.CLOUDINARY_CLOUD_NAME, apiKey = env.CLOUDINARY_API_KEY, apiSecret = env.CLOUDINARY_API_SECRET;
  const uploadPreset = env.CLOUDINARY_UPLOAD_PRESET || "ramesh_photography";
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary configuration is incomplete. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in production.");
  return { cloudName, apiKey, apiSecret, uploadPreset };
}
export async function createUploadPayload(env, eventCode, resourceType) {
  const config = cloudinaryConfig(env), timestamp = Math.floor(Date.now() / 1000);
  const folder = "ramesh-photography/" + eventCode;
  const params = { folder, timestamp: String(timestamp), upload_preset: config.uploadPreset };
  return {
    cloudName: config.cloudName, apiKey: config.apiKey, uploadPreset: config.uploadPreset,
    timestamp, folder, signature: await cloudinarySignature(params, config.apiSecret),
    resourceType, uploadUrl: "https://api.cloudinary.com/v1_1/" + config.cloudName + "/" + resourceType + "/upload"
  };
}
