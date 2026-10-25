import { readAuthCookiePrefix } from "@repo/backend/confect/auth/cookie";
import { siteUrlKeys } from "@repo/site/keys";
import { getSessionCookie, stripSecureCookiePrefix } from "better-auth/cookies";

/** The name Better Auth's Convex plugin gives the cookie of the Convex token, before the site's prefix. */
const CONVEX_TOKEN_COOKIE = "convex_jwt";

/** The cookie prefix of this site, as Better Auth writes it (`readAuthCookiePrefix`). */
function siteCookiePrefix() {
  return readAuthCookiePrefix(new URL(siteUrlKeys().SITE_URL));
}

/**
 * The Better Auth session cookie that a request sends to this site, or null. The
 * name carries the site's own prefix (`readAuthCookiePrefix`), so on staging and
 * in local development production's cookie, which the browser also sends there,
 * never reads as the session.
 */
export function readSessionCookie(request: Request | Headers) {
  return getSessionCookie(request, { cookiePrefix: siteCookiePrefix() });
}

/**
 * The Convex token cookie that a request sends to this site, or null. Better Auth
 * names it like the session cookie, with the site's prefix and, on HTTPS, the
 * secure prefix, and gives it the token's own lifetime.
 */
export function readConvexTokenCookie(request: Request | Headers) {
  return getSessionCookie(request, {
    cookieName: CONVEX_TOKEN_COOKIE,
    cookiePrefix: siteCookiePrefix(),
  });
}

/** Whether one Set-Cookie name is this site's Convex token cookie, with or without the secure prefix. */
export function isConvexTokenCookieName(name: string) {
  return (
    stripSecureCookiePrefix(name) ===
    `${siteCookiePrefix()}.${CONVEX_TOKEN_COOKIE}`
  );
}
