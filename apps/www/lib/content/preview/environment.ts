import { previewKeys } from "@repo/next-config/keys";

/** Returns the ephemeral provider fields owned by the Aksara child. */
export function readPreviewEnvironment() {
  const keys = previewKeys();
  return {
    eventsPath: keys.AKSARA_PREVIEW_EVENTS_PATH,
    keyId: keys.AKSARA_PREVIEW_KEY_ID,
    manifestPath: keys.AKSARA_PREVIEW_MANIFEST_PATH,
    origin: keys.AKSARA_PREVIEW_ORIGIN,
    publicKey: keys.AKSARA_PREVIEW_PUBLIC_KEY,
    token: keys.AKSARA_PREVIEW_PROVIDER_TOKEN,
  };
}

/** Returns the ephemeral renderer fields owned by the Aksara child. */
export function readPreviewRendererEnvironment() {
  const keys = previewKeys();
  return {
    secret: keys.AKSARA_PREVIEW_RENDERER_SECRET,
    token: keys.AKSARA_PREVIEW_RENDERER_TOKEN,
  };
}
