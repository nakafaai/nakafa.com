import { readAuthCookiePrefix } from "@repo/backend/confect/auth/cookie";
import { siteUrlKeys } from "@repo/site/keys";
import { getSessionCookie } from "better-auth/cookies";

/**
 * The Better Auth session cookie that a request sends to this site, or null. The
 * name carries the site's own prefix (`readAuthCookiePrefix`), so on staging and
 * in local development production's cookie, which the browser also sends there,
 * never reads as the session.
 */
export function readSessionCookie(request: Request | Headers) {
  return getSessionCookie(request, {
    cookiePrefix: readAuthCookiePrefix(new URL(siteUrlKeys().SITE_URL)),
  });
}
