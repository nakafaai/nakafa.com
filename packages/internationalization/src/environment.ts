/** Allows contract-supported route locales only inside an Aksara dev child. */
export function hasCandidateLocalePreview() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.AKSARA_PREVIEW_ORIGIN !== undefined
  );
}
