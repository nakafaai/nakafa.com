import { appUrlKeys } from "@repo/next-config/keys";

/**
 * Returns the configured public app origin for absolute URLs.
 */
export function getAppUrl() {
  return appUrlKeys().NEXT_PUBLIC_APP_URL;
}
