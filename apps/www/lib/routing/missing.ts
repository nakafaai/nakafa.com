import {
  type AppLocaleCode,
  AppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { routing } from "@repo/internationalization/src/routing";
import { Array as Arr, Option, Schema } from "effect";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

const handleLocalizedRequest = createMiddleware(routing);
const decodeAppLocale = Schema.decodeUnknownOption(AppLocaleCodeSchema);

/** Decodes one path segment as next-intl does, and yields none when the segment does not decode. */
const decodeSegment = Option.liftThrowable(decodeURI);

/** The app locale that the first segment of a path names, or none when the path names no locale. */
function readPathLocale(pathname: string) {
  const [segment] = Arr.filter(pathname.split("/"), Boolean);
  return Option.fromUndefinedOr(segment).pipe(
    Option.flatMap(decodeSegment),
    Option.flatMap(decodeAppLocale)
  );
}

/**
 * The locale of the page that the routing gives a path which names none: the
 * page it rewrites the path to, or the path it redirects the visitor to. The
 * routing passes on a path that it cannot decode without either, so none is
 * named.
 */
function readNegotiatedLocale(request: NextRequest) {
  const response = handleLocalizedRequest(request);
  return Option.fromNullOr(response.headers.get("x-middleware-rewrite")).pipe(
    Option.orElse(() => Option.fromNullOr(response.headers.get("location"))),
    Option.map((destination) => new URL(destination, request.url).pathname),
    Option.flatMap(readPathLocale)
  );
}

/**
 * The locale of a page that is not found: the locale that its path names, or
 * else the one that the routing negotiates for the request, from the NEXT_LOCALE
 * cookie, then Accept-Language, then the default. A path that the routing passes
 * on names no locale, so the default serves it, as the routing does.
 */
export function readMissingLocale(request: NextRequest): AppLocaleCode {
  return readPathLocale(request.nextUrl.pathname).pipe(
    Option.orElse(() => readNegotiatedLocale(request)),
    Option.getOrElse(() => routing.defaultLocale)
  );
}
