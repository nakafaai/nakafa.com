import type { Locale } from "@repo/internationalization/src/locale";
import { LocaleSchema } from "@repo/internationalization/src/locale";
import { isNotFound } from "@tanstack/react-router";
import { Option, Schema } from "effect";
import { readRequestHostname, readSchoolSlug } from "@/lib/routing/school/host";

/**
 * The not-found page that the server answers a refused or missing address with
 * (ADR 0026): the locale that it renders in, and whether the request came to a
 * school host. The root route's not-found error carries it, so the document
 * speaks that locale too.
 */
export const NotFoundPageData = Schema.Struct({
  locale: LocaleSchema,
  school: Schema.Boolean,
});

/** The not-found page of one answer, as `NotFoundPageData` declares it. */
export type NotFoundPage = typeof NotFoundPageData.Type;

/** The locale of the not-found page, as its not-found error names it, or none for any other error. */
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
 * The not-found page of a request in one locale, which knows whether the request
 * came to a school host. The host comes from the `host` header, as the school
 * gate reads it.
 */
export function notFoundPageOf(request: Request, locale: Locale): NotFoundPage {
  return {
    locale,
    school: Option.isSome(
      Option.flatMap(readRequestHostname(request.headers), readSchoolSlug)
    ),
  };
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
