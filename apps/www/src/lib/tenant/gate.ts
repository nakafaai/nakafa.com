import type { Locale } from "@repo/internationalization/src/locale";
import { negotiateLocale } from "@repo/internationalization/src/negotiate";
import { mergeVaryHeader } from "@repo/utilities/http/accept";
import { Option } from "effect";
import { isSchoolTreePath, pathLocale } from "@/lib/routing/locale/address";
import { readSchoolSlug } from "@/lib/routing/school/host";
import { createWwwHeaders, readWwwHeaderOrigins } from "@/lib/security/headers";

/** The request headers that choose a school's language and answer. */
const SCHOOL_VARY_FIELDS = ["Accept-Language", "Cookie"];

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
    Option.getOrElse(pathLocale(pathname), () =>
      negotiateLocale(request.headers)
    )
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
