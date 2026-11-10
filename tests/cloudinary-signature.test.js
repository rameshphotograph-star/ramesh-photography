import test from "node:test";
import assert from "node:assert/strict";
import { cloudinarySignature, createUploadPayload } from "../functions/_lib/cloudinary.js";

test("signed browser upload works without an upload preset", async () => {
  const env = {
    CLOUDINARY_CLOUD_NAME: "demo-cloud",
    CLOUDINARY_API_KEY: "12345",
    CLOUDINARY_API_SECRET: "test-secret",
    CLOUDINARY_FOLDER_PREFIX: "ramesh-photography-preview"
  };
  const payload = await createUploadPayload(env, "EVT-TEST01", "image");
  assert.equal(payload.uploadPreset, "");
  assert.equal(payload.folder, "ramesh-photography-preview/EVT-TEST01");
  const expected = await cloudinarySignature(
    { folder: payload.folder, timestamp: String(payload.timestamp) },
    env.CLOUDINARY_API_SECRET
  );
  assert.equal(payload.signature, expected);
  assert.match(payload.uploadUrl, /\/demo-cloud\/image\/upload$/);
});

test("explicit signed preset is included in the signature only when configured", async () => {
  const env = {
    CLOUDINARY_CLOUD_NAME: "demo-cloud",
    CLOUDINARY_API_KEY: "12345",
    CLOUDINARY_API_SECRET: "test-secret",
    CLOUDINARY_FOLDER_PREFIX: "preview",
    CLOUDINARY_UPLOAD_PRESET: "signed_preview_preset"
  };
  const payload = await createUploadPayload(env, "EVT-TEST02", "video");
  assert.equal(payload.uploadPreset, "signed_preview_preset");
  const expected = await cloudinarySignature(
    { folder: payload.folder, timestamp: String(payload.timestamp), upload_preset: "signed_preview_preset" },
    env.CLOUDINARY_API_SECRET
  );
  assert.equal(payload.signature, expected);
});
