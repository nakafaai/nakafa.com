import { SITE_ORIGIN } from "@repo/seo/origin";
import { getCookies } from "better-auth/cookies";

/** Better Auth's own cookie prefix, which production keeps. */
const PRODUCTION_COOKIE_PREFIX = "better-auth";

/**
 * The cookie prefix of every other site that production's session cookie
 * reaches: staging.nakafa.com and the local development host, which share the
 * dev deployment, so both read the same names.
 */
const SHADOWED_COOKIE_PREFIX = "nakafa-dev";

/**
 * The prefix of a site's Better Auth cookies. Production names its session
 * cookie for its own domain, so every school host shares it (ADR 0026), and the
 * browser sends that cookie to every other host under the domain too, before a
 * newer cookie of the same name. A site there with Better Auth's names would read
 * production's cookie and find no session, so it names its cookies apart. A site
 * that production's cookie does not reach, such as `localhost`, keeps them.
 */
export function readAuthCookiePrefix(siteUrl: URL) {
  const production = new URL(SITE_ORIGIN).hostname;
  return siteUrl.hostname !== production &&
    sharedCookieReaches(siteUrl.hostname, production)
    ? SHADOWED_COOKIE_PREFIX
    : PRODUCTION_COOKIE_PREFIX;
}

/**
 * The name of the session cookie that a site without school hosts wrote. Its
 * name is the same as the shared cookie's, but it has no Domain attribute, so
 * the browser keeps it for the site's own host only.
 */
export function readHostOnlySessionCookieName(siteUrl: URL) {
  return getCookies({
    advanced: { cookiePrefix: readAuthCookiePrefix(siteUrl) },
    baseURL: siteUrl.href,
  }).sessionToken.name;
}

/**
 * Whether the shared session cookie reaches a host. It always reaches the host
 * that its domain names. A subdomain receives it only when the domain has a dot.
 * A single-label domain such as `localhost` names one host: Chromium sends a
 * `Domain=localhost` cookie to `localhost`, and not to `school.localhost`.
 */
export function sharedCookieReaches(hostname: string, cookieDomain: string) {
  if (hostname === cookieDomain) {
    return true;
  }
  return cookieDomain.includes(".") && hostname.endsWith(`.${cookieDomain}`);
}
