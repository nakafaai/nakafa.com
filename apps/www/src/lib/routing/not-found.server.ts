import "@tanstack/react-start/server-only";

import { getRequestHeaders } from "@tanstack/react-start/server";
import { readNotFoundLocale } from "@/lib/routing/not-found";

/** The locale of the standalone not-found page, as the request names it. */
export function readNotFoundLocaleHandler() {
  return readNotFoundLocale(getRequestHeaders());
}
