import {
  SCHOOL_API_PATH,
  SCHOOL_HOST_API_PATH,
  SCHOOL_HOST_MCP_PATH,
  SCHOOL_MCP_PATH,
} from "@repo/backend/confect/integrations/api";
import {
  Array as Arr,
  Effect,
  Option,
  Record as Rec,
  Schema,
  String as Str,
  Tuple,
} from "effect";
import { HttpBody } from "effect/http";
import { readRequestHostname, readSchoolSlug } from "@/lib/routing/school/host";

/**
 * The paths a school host serves for integrations (ADR 0026, ADR 0029), each with the Convex
 * path it forwards to: the REST API under `/api/v1`, and the MCP server at `/mcp`.
 */
const FORWARDS = [
  { convex: SCHOOL_API_PATH, host: SCHOOL_HOST_API_PATH },
  { convex: SCHOOL_MCP_PATH, host: SCHOOL_HOST_MCP_PATH },
];

/** The methods a forward sends on: the reads, the token request and the MCP posts, and a preflight. */
export const ForwardedMethod = Schema.Literals(["GET", "POST", "OPTIONS"]);

/**
 * The request headers the school API and MCP server read: the bearer token, the body's
 * type, and the MCP protocol headers. A cookie never passes.
 */
const REQUEST_HEADERS = [
  "accept",
  "authorization",
  "content-type",
  "mcp-method",
  "mcp-name",
  "mcp-protocol-version",
];

/** The response headers a caller of the school API reads. */
const RESPONSE_HEADERS = [
  "cache-control",
  "content-type",
  "retry-after",
  "www-authenticate",
];

/**
 * The Convex address that one school host request forwards to: the same path under the
 * Convex path of its forward, with its query, on the cell's own Convex site. A host that
 * names no school, or a path no forward serves, forwards nowhere, so the main site never
 * serves a school path (ADR 0026).
 */
export function schoolApiTarget(
  request: Request,
  convexSiteUrl: string
): Option.Option<URL> {
  const url = new URL(request.url);
  return Option.flatMap(
    Option.flatMap(readRequestHostname(request.headers), readSchoolSlug),
    () =>
      Option.map(
        Arr.findFirst(
          FORWARDS,
          (forward) =>
            url.pathname === forward.host ||
            Str.startsWith(`${forward.host}/`)(url.pathname)
        ),
        (forward) =>
          new URL(
            `${forward.convex}${url.pathname.slice(forward.host.length)}${url.search}`,
            convexSiteUrl
          )
      )
  );
}

/**
 * The body of a forwarded request: a POST's bytes, sent as they came with the media type
 * they came with, or none. Effect's client sends a body's own media type as the request's
 * `content-type`, so the forwarded header alone would be replaced by
 * `application/octet-stream`, and the token endpoint would refuse a form.
 */
export const forwardedBody = (request: Request) =>
  request.method === "POST"
    ? Effect.map(
        Effect.promise(() => request.arrayBuffer()),
        (bytes) =>
          HttpBody.uint8Array(
            new Uint8Array(bytes),
            request.headers.get("content-type") ?? undefined
          )
      )
    : Effect.succeed(HttpBody.empty);

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
