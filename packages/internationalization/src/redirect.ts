import { negotiateLocale } from "@repo/internationalization/src/negotiate";
import {
  isSharedPath,
  toPublicPath,
} from "@repo/internationalization/src/rewrite";
import { Option, Schema } from "effect";

/** The headers that tell a cache the locale answer depends on the request. */
export const LOCALE_VARY = "Accept-Language, Cookie";

/** The redirect that the request middleware answers before routing. */
const RedirectDecision = Schema.Struct({
  location: Schema.String,
  status: Schema.Literals([307, 308]),
  vary: Schema.optionalKey(Schema.String),
});

type RedirectDecision = typeof RedirectDecision.Type;

const SLASH_RUNS = /\/{2,}/gu;
const TRAILING_SLASHES = /\/+$/u;

/**
 * Collapses every run of slashes and removes the trailing ones. A path that
 * starts with two slashes would read as a protocol-relative address, so no
 * redirect target starts with `//`. The root path stays the root path.
 */
function normalizePathname(pathname: string) {
  return pathname.replace(SLASH_RUNS, "/").replace(TRAILING_SLASHES, "") || "/";
}

/** A permanent redirect to another path of the same host, or none when the path does not change. */
function redirectToPath(url: URL, pathname: string) {
  if (pathname === url.pathname) {
    return Option.none();
  }
  return Option.some(
    RedirectDecision.make({
      location: `${pathname}${url.search}`,
      status: 308,
    })
  );
}

/**
 * The 308 to the canonical slash spelling of a path: every run of slashes
 * collapses and the trailing ones go. Shared paths never redirect, and a path
 * that is already canonical has no answer.
 */
export function decideSlashRedirect(url: URL): Option.Option<RedirectDecision> {
  if (isSharedPath(url.pathname)) {
    return Option.none();
  }
  return redirectToPath(url, normalizePathname(url.pathname));
}

/**
 * Decides the redirect of one request before routing, from the URL, the
 * `Accept-Language` header and the locale cookie. Shared paths never redirect.
 *
 * - `/` goes to the negotiated locale with a 307, because the answer depends on
 *   the request.
 * - A run of slashes, a trailing slash or a non-public spelling goes to its
 *   canonical path with a 308, in one hop.
 * - A school host has no locale in its path, so only the trailing slash changes.
 * - Anything else passes through, including an unknown locale, which the router
 *   answers with a 404.
 */
export function decideRedirect(input: {
  readonly headers: Headers;
  readonly url: URL;
  /** Whether the host names a school. The caller reads the school address, so this seam stays free of tenant rules. */
  readonly isSchoolHost: boolean;
}): Option.Option<RedirectDecision> {
  const { url } = input;
  if (isSharedPath(url.pathname)) {
    return Option.none();
  }
  const path = normalizePathname(url.pathname);
  if (input.isSchoolHost) {
    return redirectToPath(url, path);
  }
  if (path === "/") {
    return Option.some(
      RedirectDecision.make({
        location: `/${negotiateLocale(input.headers)}${url.search}`,
        status: 307,
        vary: LOCALE_VARY,
      })
    );
  }
  return redirectToPath(url, toPublicPath(path));
}
