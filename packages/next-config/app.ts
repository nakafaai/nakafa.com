import { keys } from "@repo/next-config/keys";

/**
 * Returns the configured public app origin for absolute URLs.
 */
export function getAppUrl() {
  return keys().NEXT_PUBLIC_APP_URL;
}
