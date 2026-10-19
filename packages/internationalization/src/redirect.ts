import { negotiateLocale } from "@repo/internationalization/src/negotiate";
import {
  isSharedPath,
  readSchoolSlug,
  toPublicPath,
} from "@repo/internationalization/src/rewrite";
import { Option, Schema } from "effect";

/** The headers that tell a cache the locale answer depends on the request. */
const LOCALE_VARY = "Accept-Language, Cookie";

/** The redirect that the request middleware answers before routing. */
const RedirectDecision = Schema.Struct({
  location: Schema.String,
  status: Schema.Literals([307, 308]),
  vary: Schema.optionalKey(Schema.String),
});

type RedirectDecision = typeof RedirectDecision.Type;

const TRAILING_SLASHES = /\/+$/u;

/** Removes every trailing slash. The root path stays the root path. */
function trimTrailingSlashes(pathname: string) {
  return pathname.replace(TRAILING_SLASHES, "") || "/";
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
 * Decides the redirect of one request before routing, from the URL, the
 * `Accept-Language` header and the locale cookie. Shared paths never redirect.
 *
 * - `/` goes to the negotiated locale with a 307, because the answer depends on
 *   the request.
 * - A trailing slash or a non-public spelling goes to its canonical path with a
 *   308, in one hop.
 * - A school host has no locale in its path, so only the trailing slash changes.
 * - Anything else passes through, including an unknown locale, which the router
 *   answers with a 404.
 */
export function decideRedirect(input: {
  readonly headers: Headers;
  readonly url: URL;
}): Option.Option<RedirectDecision> {
  const { url } = input;
  if (isSharedPath(url.pathname)) {
    return Option.none();
  }
  const path = trimTrailingSlashes(url.pathname);
  if (Option.isSome(readSchoolSlug(url.hostname))) {
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
