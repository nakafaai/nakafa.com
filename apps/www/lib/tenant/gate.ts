import { decodeLocale } from "@repo/internationalization/src/locale";
import { mergeVaryHeader } from "@repo/utilities/http/accept";
import { Array as Arr, Option } from "effect";
import { readSchoolSlug } from "@/lib/routing/school/host";

/** The segment of the router tree that holds every school page (ADR 0026). */
const SCHOOL_SEGMENT = "school";

/** The page of a main host where an account opens its own school. No school can take this address. */
const SCHOOL_START_SEGMENT = "new";

/** The request headers that choose a school's language and answer. */
const SCHOOL_VARY_FIELDS = ["Accept-Language", "Cookie"];

/** Decodes one path segment the way the router does, so an encoded segment names the same page. */
const decodeSegment = Option.liftThrowable(decodeURI);

/** The decoded segment at an index, or none when the path has no such segment or it does not decode. */
function readSegment(segments: readonly string[], index: number) {
  return Arr.get(segments, index).pipe(Option.flatMap(decodeSegment));
}

/**
 * Whether a path points into the school tree, with or without a locale in front.
 * Only a school host reaches that tree, so a main host answers such a path with
 * not found. The start page of an account is the one exception.
 */
export function isSchoolTreePath(pathname: string): boolean {
  const segments = Arr.filter(pathname.split("/"), Boolean);
  const startsWithLocale = Option.isSome(
    Option.flatMap(readSegment(segments, 0), decodeLocale)
  );
  const school = startsWithLocale ? 1 : 0;
  if (!Option.contains(readSegment(segments, school), SCHOOL_SEGMENT)) {
    return false;
  }
  return !(
    segments.length === school + 2 &&
    Option.contains(readSegment(segments, school + 1), SCHOOL_START_SEGMENT)
  );
}

/** The hostname that the `host` header names, without its port, or none when the header names no host. */
const readHostname = Option.liftThrowable(
  (host: string) => new URL(`http://${host}`).hostname
);

/**
 * The school address that the request's host names, or none for a main host. The
 * host comes from the `host` header and not from the request URL, because a
 * server that builds its URL from its own address names that address for every
 * host.
 */
function readRequestSchool(headers: Headers) {
  return Option.fromNullishOr(headers.get("host")).pipe(
    Option.flatMap(readHostname),
    Option.flatMap(readSchoolSlug)
  );
}

/**
 * Answers a school tree path of a main host with not found before the router
 * sees it, and returns none for every other request. The answer names no page,
 * so no search engine indexes the address.
 */
export function answerSchoolGate(request: Request): Option.Option<Response> {
  if (Option.isSome(readRequestSchool(request.headers))) {
    return Option.none();
  }
  if (!isSchoolTreePath(new URL(request.url).pathname)) {
    return Option.none();
  }
  return Option.some(
    withPageHeaders(
      request,
      new Response("Not Found", {
        headers: { "content-type": "text/plain; charset=utf-8" },
        status: 404,
      })
    )
  );
}

/**
 * Sets the headers that every school page and every not-found answer carry: the
 * page is not indexed, and its answer depends on the language and the session.
 * Other responses of a main host pass through unchanged.
 */
export function withPageHeaders(request: Request, response: Response) {
  const isSchoolHost = Option.isSome(readRequestSchool(request.headers));
  if (!isSchoolHost && response.status !== 404) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("x-robots-tag", "noindex");
  if (isSchoolHost) {
    headers.set(
      "vary",
      mergeVaryHeader(
        Option.fromNullishOr(headers.get("vary")),
        SCHOOL_VARY_FIELDS
      )
    );
  }
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
