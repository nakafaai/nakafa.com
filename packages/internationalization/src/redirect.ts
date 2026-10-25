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
 * The 308 to the public spelling of a locale-prefixed path, such as `/en/curricula`
 * to `/en/curriculum`. The server entry asks this before the negotiation, so a
 * Markdown request for a non-public spelling moves too. A school host has no
 * locale in its path, so it has no answer here.
 */
export function decideSpellingRedirect(input: {
  readonly isSchoolHost: boolean;
  readonly url: URL;
}): Option.Option<RedirectDecision> {
  if (input.isSchoolHost) {
    return Option.none();
  }
  return redirectToPath(input.url, toPublicPath(input.url.pathname));
}

/**
 * The 307 to the negotiated locale for the root path, which the router answers
 * after the negotiation, so a Markdown request for the root never waits for a
 * locale. A school host keeps its own home at the root, so it has no answer.
 */
export function decideRootRedirect(input: {
  readonly headers: Headers;
  /** Whether the host names a school. The caller reads the school address, so this seam stays free of tenant rules. */
  readonly isSchoolHost: boolean;
  readonly url: URL;
}): Option.Option<RedirectDecision> {
  if (input.isSchoolHost || input.url.pathname !== "/") {
    return Option.none();
  }
  return Option.some(
    RedirectDecision.make({
      location: `/${negotiateLocale(input.headers)}${input.url.search}`,
      status: 307,
      vary: LOCALE_VARY,
    })
  );
}
