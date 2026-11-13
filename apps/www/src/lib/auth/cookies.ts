import {
  AUTH_JWT_COOKIE,
  AUTH_REFRESH_COOKIE,
  type AuthCookieOptions,
} from "@convex-dev/auth/ssr";
import { MAIN_DOMAIN } from "@repo/site/domains";
import { Array as Arr, Result, String as Str } from "effect";

/**
 * The prefix of the auth cookies of a site that production's cookies reach and
 * that is not production: staging. Production names its cookies for its whole
 * domain, so every school host shares the session (ADR 0026), and the browser
 * sends them to staging too; staging names its own apart, so it never reads
 * production's session as its own.
 */
const SHADOWED_PREFIX = "nakafa-dev.";

/** The auth cookies Convex Auth reads and writes, by the names it gives them. */
const AUTH_COOKIES = [AUTH_JWT_COOKIE, AUTH_REFRESH_COOKIE];

/** How one site scopes and names its auth cookies. */
export function siteAuthCookies(site: URL) {
  const production = site.hostname === MAIN_DOMAIN;
  const shadowed = !production && site.hostname.endsWith(`.${MAIN_DOMAIN}`);
  const options: AuthCookieOptions = {
    secure: site.protocol === "https:",
    ...(production ? { domain: MAIN_DOMAIN } : {}),
  };
  return { options, prefix: shadowed ? SHADOWED_PREFIX : "" };
}

/** One `name=value` pair of a Cookie header, split at its first `=`; a text without one is no pair. */
const splitPair = (pair: string) => {
  const at = pair.indexOf("=");
  return at < 0
    ? Result.failVoid
    : Result.succeed([
        Str.trim(pair.slice(0, at)),
        pair.slice(at + 1),
      ] as const);
};

/**
 * The Cookie header that Convex Auth's handlers read on a site with a prefix:
 * the site's own auth cookies under Convex Auth's names, and no cookie that
 * already holds such a name, which production set.
 */
export function inboundCookieHeader(header: string, prefix: string) {
  if (prefix === "") {
    return header;
  }
  const pairs = Arr.filterMap(Str.split(header, ";"), splitPair);
  const kept = Arr.filterMap(pairs, ([name, value]) => {
    if (Arr.contains(AUTH_COOKIES, name)) {
      return Result.failVoid;
    }
    const unprefixed = Str.startsWith(prefix)(name)
      ? name.slice(prefix.length)
      : name;
    return Result.succeed(`${unprefixed}=${value}`);
  });
  return Arr.join(kept, "; ");
}

/** A Set-Cookie value that Convex Auth wrote, renamed with the site's prefix when it names an auth cookie. */
export function outboundSetCookie(value: string, prefix: string) {
  if (prefix === "") {
    return value;
  }
  const name = Str.trim(value.slice(0, value.indexOf("=")));
  return Arr.contains(AUTH_COOKIES, name) ? `${prefix}${value}` : value;
}

/**
 * Whether a request carries this site's session: its refresh cookie, under the
 * site's own name. The cookie proves nothing by itself; a reader that needs the
 * session reads it (`session.server`).
 */
export function hasSessionCookie(request: Request, site: URL) {
  const name = `${siteAuthCookies(site).prefix}${AUTH_REFRESH_COOKIE}`;
  return Arr.some(
    Arr.filterMap(
      Str.split(request.headers.get("cookie") ?? "", ";"),
      splitPair
    ),
    ([key, value]) => key === name && value !== ""
  );
}
