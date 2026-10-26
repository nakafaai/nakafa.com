import { getRequestHeaders } from "@tanstack/react-start/server";
import { readNotFoundPage } from "@/lib/routing/not-found";

/** What the request names for the standalone not-found page: its locale and its host. */
export function readNotFoundPageHandler() {
  return readNotFoundPage(getRequestHeaders());
}
