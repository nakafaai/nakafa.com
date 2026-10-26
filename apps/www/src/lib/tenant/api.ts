import { SCHOOL_API_PATH } from "@repo/backend/confect/integrations/api";
import { Array as Arr, Option, Record as Rec, Tuple } from "effect";
import {
  readRequestHostname,
  readSchoolSlug,
} from "@/lib/routing/school/host";

/** The path a school host serves its REST API under (ADR 0026, ADR 0029). */
export const SCHOOL_HOST_API_PATH = "/api/v1";

/** The request headers the school API reads: the bearer token and the body's type. A cookie never passes. */
const REQUEST_HEADERS = ["accept", "authorization", "content-type"];

/** The response headers a caller of the school API reads. */
const RESPONSE_HEADERS = [
  "cache-control",
  "content-type",
  "retry-after",
  "www-authenticate",
];

/**
 * The Convex address that one school host request forwards to: the same path under the
 * school API's path of the cell's own Convex site, with its query. A host that names no
 * school forwards nowhere, so the main site never serves a school path (ADR 0026).
 */
export function schoolApiTarget(
  request: Request,
  convexSiteUrl: string
): Option.Option<URL> {
  return Option.map(
    Option.flatMap(readRequestHostname(request.headers), readSchoolSlug),
    () => {
      const url = new URL(request.url);
      const rest = url.pathname.slice(SCHOOL_HOST_API_PATH.length);
      return new URL(`${SCHOOL_API_PATH}${rest}${url.search}`, convexSiteUrl);
    }
  );
}

/** The headers of a forwarded request: the ones the API reads, and never a cookie. */
export function forwardedRequestHeaders(headers: Headers) {
  return new Headers(
    Arr.flatMap(REQUEST_HEADERS, (name) =>
      Option.match(Option.fromNullOr(headers.get(name)), {
        onNone: () => [],
        onSome: (value) => [Tuple.make(name, value)],
      })
    )
  );
}

/**
 * The headers of a forwarded answer: the ones a caller reads, and never a cookie. The
 * answer comes from Effect's HTTP client, whose headers are a record of lowercase names.
 */
export function forwardedResponseHeaders(
  headers: Readonly<Record<string, string>>
) {
  return new Headers(
    Arr.flatMap(RESPONSE_HEADERS, (name) =>
      Option.match(Rec.get(headers, name), {
        onNone: () => [],
        onSome: (value) => [Tuple.make(name, value)],
      })
    )
  );
}
