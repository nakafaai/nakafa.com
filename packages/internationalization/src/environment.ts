const candidateLocalePreviewEnvironmentNames = [
  "AKSARA_PREVIEW_EVENTS_PATH",
  "AKSARA_PREVIEW_KEY_ID",
  "AKSARA_PREVIEW_MANIFEST_PATH",
  "AKSARA_PREVIEW_ORIGIN",
  "AKSARA_PREVIEW_PUBLIC_KEY",
  "AKSARA_PREVIEW_PROVIDER_TOKEN",
] as const;

/** Allows contract-supported route locales only inside an Aksara dev child. */
export function hasCandidateLocalePreview() {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }

  return candidateLocalePreviewEnvironmentNames.some(
    (name) => process.env[name] !== undefined
  );
}
