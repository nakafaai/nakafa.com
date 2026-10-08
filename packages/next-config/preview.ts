// apps/www/next.config.ts loads this module through Next's config transpiler,
// which emits `@repo/*` imports relative to apps/www. Keep this file directly
// under packages/next-config, the depth at which those paths still resolve.
import { previewKeys } from "@repo/next-config/keys";
import { Array as Arr } from "effect";

/**
 * Reports whether the development child set any provider field. A partial
 * configuration counts, so strict decoding reports it instead of falling back.
 */
export function hasPreviewProvider() {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }

  const keys = previewKeys();
  return Arr.some(
    [
      keys.AKSARA_PREVIEW_EVENTS_PATH,
      keys.AKSARA_PREVIEW_KEY_ID,
      keys.AKSARA_PREVIEW_MANIFEST_PATH,
      keys.AKSARA_PREVIEW_ORIGIN,
      keys.AKSARA_PREVIEW_PUBLIC_KEY,
      keys.AKSARA_PREVIEW_PROVIDER_TOKEN,
    ],
    (value) => value !== undefined
  );
}

/** Reports whether the development child set any renderer field. */
export function hasPreviewRenderer() {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }

  const keys = previewKeys();
  return (
    keys.AKSARA_PREVIEW_RENDERER_SECRET !== undefined ||
    keys.AKSARA_PREVIEW_RENDERER_TOKEN !== undefined
  );
}
