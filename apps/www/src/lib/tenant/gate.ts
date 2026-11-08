import {
  decodeLocale,
  type Locale,
} from "@repo/internationalization/src/locale";
import { negotiateLocale } from "@repo/internationalization/src/negotiate";
import { LOCALE_VARY } from "@repo/internationalization/src/redirect";
import { mergeVaryHeader } from "@repo/utilities/http/accept";
import { Array as Arr, Option } from "effect";
import { MAIN_HOST_SCHOOL_PAGES } from "@/lib/ownership/route";
import { readSchoolSlug } from "@/lib/routing/school/host";
import { createWwwHeaders, readWwwHeaderOrigins } from "@/lib/security/headers";

/** The segment of the router tree that holds every school page (ADR 0026). */
const SCHOOL_SEGMENT = "school";

/** The request headers that choose a school's language and answer. */
const SCHOOL_VARY_FIELDS = ["Accept-Language", "Cookie"];

/** Decodes one path segment the way the router does, so an encoded segment names the same page. */
const decodeSegment = Option.liftThrowable(decodeURI);

/** The decoded segment at an index, or none when the path has no such segment or it does not decode. */
function readSegment(segments: readonly string[], index: number) {
  return Arr.get(segments, index).pipe(Option.flatMap(decodeSegment));
}

/** The non-empty segments of a path. */
function pathSegments(pathname: string) {
  return Arr.filter(pathname.split("/"), Boolean);
}

/** The locale that a path names in front, or none for a path without one. */
function readPathLocale(segments: readonly string[]) {
  return Option.flatMap(readSegment(segments, 0), decodeLocale);
}

/**
 * The main host's School page that a path names after its `school` segment, such
 * as `pricing`, or `""` for the landing, or none when the path names a school's
 * page. The segment after `school` is decoded the way the router decodes it.
 */
function readMainHostSchoolPage(segments: readonly string[], school: number) {
  const rest = Arr.drop(segments, school + 1);
  if (rest.length > 1) {
    return Option.none();
  }
  return Option.filter(
    rest.length === 0 ? Option.some("") : readSegment(rest, 0),
    (page) => Arr.contains(MAIN_HOST_SCHOOL_PAGES, page)
  );
}

/** Where a path's `school` segment stands: after its locale, or first. None when the path does not start there. */
function readSchoolIndex(segments: readonly string[]) {
  const school = Option.isSome(readPathLocale(segments)) ? 1 : 0;
  return Option.contains(readSegment(segments, school), SCHOOL_SEGMENT)
    ? Option.some(school)
    : Option.none();
}

/**
 * Whether a path points into the school tree, with or without a locale in front.
 * Only a school host reaches that tree, so a main host answers such a path with
 * not found. The main host's own School pages are the exceptions, with or
 * without their locale (`MAIN_HOST_SCHOOL_PAGES`).
 */
export function isSchoolTreePath(pathname: string): boolean {
  const segments = pathSegments(pathname);
  return Option.exists(readSchoolIndex(segments), (school) =>
    Option.isNone(readMainHostSchoolPage(segments, school))
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
 * The locale of the not-found page that answers a school tree path of a main host
 * before the router sees it, or none for every other request: the locale that the
 * path names, or the one that the request negotiates for a path without one. The
 * page names no school, so no search engine indexes the address.
 */
export function readSchoolTreeGate(request: Request): Option.Option<Locale> {
  if (Option.isSome(readRequestSchool(request.headers))) {
    return Option.none();
  }
  const { pathname } = new URL(request.url);
  if (!isSchoolTreePath(pathname)) {
    return Option.none();
  }
  return Option.some(
    Option.getOrElse(readPathLocale(pathSegments(pathname)), () =>
      negotiateLocale(request.headers)
    )
  );
}

/**
 * The redirect of a main host's School page written without its locale, such as
 * `/school` or `/school/pricing?plan=pro`: it opens in the negotiated locale with
 * a 307 and its query, as every bare page address does (`readBareRedirect`). The
 * school tree's routes start with `school`, so these addresses are never bare,
 * and this answers them first. A school host serves its own tree at these paths.
 */
export function readSchoolPageRedirect(
  request: Request
): Option.Option<Response> {
  if (Option.isSome(readRequestSchool(request.headers))) {
    return Option.none();
  }
  const url = new URL(request.url);
  const segments = pathSegments(url.pathname);
  return Option.filter(
    readSchoolIndex(segments),
    (school) => school === 0
  ).pipe(
    Option.flatMap((school) => readMainHostSchoolPage(segments, school)),
    Option.map((page) => {
      const path = page === "" ? SCHOOL_SEGMENT : `${SCHOOL_SEGMENT}/${page}`;
      return new Response(null, {
        headers: {
          location: `/${negotiateLocale(request.headers)}/${path}${url.search}`,
          vary: LOCALE_VARY,
        },
        status: 307,
      });
    })
  );
}

/**
 * Sets the headers that every answer carries: the security policy and the agent
 * discovery links. A school page and every not-found answer are also not indexed,
 * and a school page's answer depends on the language and the session.
 */
export function withPageHeaders(request: Request, response: Response) {
  const isSchoolHost = Option.isSome(readRequestSchool(request.headers));
  const headers = new Headers(response.headers);
  for (const { key, value } of createWwwHeaders(readWwwHeaderOrigins())) {
    headers.set(key, value);
  }
  if (isSchoolHost || response.status === 404) {
    headers.set("x-robots-tag", "noindex");
  }
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
