import { appUrlKeys } from "@repo/site/public";

/**
 * Returns the configured public app origin for absolute URLs.
 */
export function getAppUrl() {
  return appUrlKeys().VITE_SITE_URL;
}
