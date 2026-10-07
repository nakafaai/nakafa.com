import { previewKeys } from "@repo/next-config/keys";

/** Allows contract-supported route locales only inside an Aksara dev child. */
export function hasCandidateLocalePreview() {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }

  const keys = previewKeys();
  return [
    keys.AKSARA_PREVIEW_EVENTS_PATH,
    keys.AKSARA_PREVIEW_KEY_ID,
    keys.AKSARA_PREVIEW_MANIFEST_PATH,
    keys.AKSARA_PREVIEW_ORIGIN,
    keys.AKSARA_PREVIEW_PUBLIC_KEY,
    keys.AKSARA_PREVIEW_PROVIDER_TOKEN,
  ].some((value) => value !== undefined);
}
