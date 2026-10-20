import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { readNotFoundLocale } from "@/lib/routing/not-found";

/** The locale of the standalone not-found page, as the request names it. */
export function readNotFoundLocaleHandler() {
  return readNotFoundLocale(getRequestHeaders());
}

/** Reads the locale of the standalone not-found page on the server, for the route's loader. */
export const readNotFoundLocaleFn = createServerFn({ method: "GET" }).handler(
  readNotFoundLocaleHandler
);
