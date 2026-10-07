/**
 * Returns the configured public app origin for absolute URLs.
 */
export function getAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is required.");
  }

  return appUrl;
}
