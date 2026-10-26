import {
  DEFAULT_LOCALE,
  decodeLocale,
  type Locale,
  LocaleSchema,
} from "@repo/internationalization/src/locale";
import { isNotFound } from "@tanstack/react-router";
import { Option, Schema } from "effect";
import { readRequestHostname, readSchoolSlug } from "@/lib/routing/school/host";

/** The request header in which the server names the locale of the standalone not-found page. */
export const NOT_FOUND_LOCALE_HEADER = "x-nakafa-locale";

/** The address of the standalone not-found page, which the server renders for a refused or missing address. */
export const NOT_FOUND_PATH = "/_missing";

/**
 * The data that the standalone page's not-found error carries: the locale that the
 * page renders in, and whether the request came to a school host.
 */
export const NotFoundPageData = Schema.Struct({
  locale: LocaleSchema,
  school: Schema.Boolean,
});

/** The locale of the standalone not-found page, as its not-found error names it, or none for any other error. */
export function readNotFoundPageLocale(error: unknown): Option.Option<Locale> {
  if (!isNotFound(error)) {
    return Option.none();
  }
  return Option.map(
    Schema.decodeUnknownOption(NotFoundPageData)(error.data),
    (data) => data.locale
  );
}

/**
 * What the request names for the standalone not-found page: its locale, or the
 * default locale when it names none, and whether it came to a school host.
 */
export function readNotFoundPage(
  headers: Headers
): typeof NotFoundPageData.Type {
  return {
    locale: Option.getOrElse(
      decodeLocale(headers.get(NOT_FOUND_LOCALE_HEADER)),
      () => DEFAULT_LOCALE
    ),
    school: Option.isSome(
      Option.flatMap(readRequestHostname(headers), readSchoolSlug)
    ),
  };
}

/**
 * The request that renders the standalone not-found page in one locale. It keeps
 * the host, the cookies and the language of the visitor's request, and replaces
 * its path and query with the page's address, so the page answers in the locale
 * that the server names.
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
