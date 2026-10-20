import {
  DEFAULT_LOCALE,
  decodeLocale,
  type Locale,
} from "@repo/internationalization/src/locale";
import { Option } from "effect";

/** The request header in which the server names the locale of the standalone not-found page. */
export const NOT_FOUND_LOCALE_HEADER = "x-nakafa-locale";

/** The address of the standalone not-found page, which the server renders for a refused or missing address. */
export const NOT_FOUND_PATH = "/_not-found";

/** The locale that the request names for the standalone not-found page, or the default locale when it names none. */
export function readNotFoundLocale(headers: Headers): Locale {
  return Option.getOrElse(
    decodeLocale(headers.get(NOT_FOUND_LOCALE_HEADER)),
    () => DEFAULT_LOCALE
  );
}

/**
 * The request that renders the standalone not-found page in one locale. It keeps
 * the host, the cookies and the language of the visitor's request, and drops its
 * path and query, so the page answers the way the address of the visitor does not.
 */
export function createNotFoundRequest(
  request: Request,
  locale: Locale
): Request {
  const url = new URL(request.url);
  url.pathname = NOT_FOUND_PATH;
  url.search = "";
  const headers = new Headers(request.headers);
  headers.set(NOT_FOUND_LOCALE_HEADER, locale);
  return new Request(url, { headers, method: "GET" });
}

/** The response with the language that the not-found page of a locale names. */
export function withContentLanguage(response: Response, locale: Locale) {
  const headers = new Headers(response.headers);
  headers.set("content-language", locale);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
