const rendererEnvironmentNames = [
  "AKSARA_PREVIEW_RENDERER_SECRET",
  "AKSARA_PREVIEW_RENDERER_TOKEN",
];

/** Reports whether the development child supplied any renderer field. */
export function hasPreviewRendererEnvironment() {
  return hasDevelopmentEnvironment(rendererEnvironmentNames);
}

/** Reads only the ephemeral provider fields owned by the Aksara child. */
export function readPreviewEnvironment() {
  return {
    eventsPath: process.env.AKSARA_PREVIEW_EVENTS_PATH,
    keyId: process.env.AKSARA_PREVIEW_KEY_ID,
    manifestPath: process.env.AKSARA_PREVIEW_MANIFEST_PATH,
    origin: process.env.AKSARA_PREVIEW_ORIGIN,
    publicKey: process.env.AKSARA_PREVIEW_PUBLIC_KEY,
    token: process.env.AKSARA_PREVIEW_PROVIDER_TOKEN,
  };
}

/** Reads only the ephemeral renderer fields owned by the Aksara child. */
export function readPreviewRendererEnvironment() {
  return {
    secret: process.env.AKSARA_PREVIEW_RENDERER_SECRET,
    token: process.env.AKSARA_PREVIEW_RENDERER_TOKEN,
  };
}

/** Detects a strict local-preview mode without accepting it in production. */
function hasDevelopmentEnvironment(names: readonly string[]) {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }

  return names.some((name) => process.env[name] !== undefined);
}
