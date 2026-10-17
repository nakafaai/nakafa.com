import { isSchoolLabel } from "@repo/backend/confect/tenancy/slug";
import { readHostname } from "@repo/utilities/http/host";
import { getCookies } from "better-auth/cookies";
import { Array as Arr, Effect, Option } from "effect";

/**
 * Whether a host name is a loopback name, which only this machine can serve: a
 * local run uses `localhost`, a `*.localhost` name, or an IP loopback address.
 */
export function isLoopbackHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

/**
 * Whether a host is a school host of the site: `<label>.<site host>`, where the
 * label is a school label (ADR 0026). The label rule refuses a reserved label
 * such as `cas`, a label of two levels such as `a.b`, and an invalid label.
 */
function isSchoolHostname(hostname: string, siteHostname: string) {
  const suffix = `.${siteHostname}`;
  return (
    hostname.endsWith(suffix) &&
    isSchoolLabel(hostname.slice(0, -suffix.length))
  );
}

/**
 * Whether the shared sign-in trusts an origin. The origin must be written as a
 * browser writes it: lowercase, with no path and no default port, so a spelling
 * that the URL parser would rewrite names no trusted host. The protocol is the
 * site's own. A local site with a port trusts its own host and its school hosts
 * on any port, because a local run serves on a port that `SITE_URL` does not
 * name. Any other site trusts its school hosts on its own port alone. The site's
 * own origin is also the base URL, which Better Auth trusts already.
 */
function isSchoolOrigin(origin: string, siteUrl: URL) {
  if (!URL.canParse(origin)) {
    return false;
  }
  const url = new URL(origin);
  if (url.origin !== origin || url.protocol !== siteUrl.protocol) {
    return false;
  }
  const anyPort = isLoopbackHostname(siteUrl.hostname) && siteUrl.port !== "";
  if (!anyPort && url.port !== siteUrl.port) {
    return false;
  }
  if (url.hostname === siteUrl.hostname) {
    return anyPort;
  }
  return isSchoolHostname(url.hostname, siteUrl.hostname);
}

/**
 * The origin that Better Auth checks for a request: its Origin header, or, when
 * that header is empty, the origin of its Referer header (`validateOrigin` in
 * `better-auth/dist/api/middlewares/origin-check.mjs`, line 98). A browser sends
 * an Origin with every POST, so the Referer answers only a client that is not a
 * browser (ADR 0026).
 */
function readCheckedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    return Option.some(origin);
  }
  return Option.flatMap(
    Option.fromNullishOr(request.headers.get("referer")),
    readRefererOrigin
  );
}

/** The origin of a Referer that parses as a URL, and none for any other text. */
function readRefererOrigin(referer: string) {
  if (!URL.canParse(referer)) {
    return Option.none();
  }
  return Option.some(new URL(referer).origin);
}

/**
 * The origins that the shared sign-in trusts for one request, for Better Auth's
 * `trustedOrigins` (ADR 0009, ADR 0026). Better Auth calls it with the request,
 * and once with no request at start, so the answer holds the origin that Better
 * Auth checks for the request only when the sign-in trusts that origin
 * (`isSchoolOrigin`), and nothing otherwise. A script on a service host such as
 * `cas.nakafa.com` therefore fails the origin check of a request that carries the
 * shared session cookie.
 */
export function readSchoolTrustedOrigins(siteUrl: URL) {
  return (request?: Request): string[] =>
    Option.toArray(
      Option.filter(
        Option.flatMap(Option.fromNullishOr(request), readCheckedOrigin),
        (origin) => isSchoolOrigin(origin, siteUrl)
      )
    );
}

/**
 * The name of the session cookie that a site without school hosts wrote. Its
 * name is the same as the shared cookie's, but it has no Domain attribute, so
 * the browser keeps it for the site's own host only.
 */
export function readHostOnlySessionCookieName(siteUrl: URL) {
  return getCookies({ baseURL: siteUrl.href }).sessionToken.name;
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

/**
 * The hostname that the browser asked for. The Next.js proxy forwards it as
 * `x-forwarded-host`, and Convex restores that header before Better Auth reads
 * the request. Without it, the response answers the backend's own host, which no
 * shared cookie of the site reaches, so the answer names no host.
 */
function readBrowserHostname(request: Request) {
  return Option.flatMap(
    Option.fromNullOr(request.headers.get("x-forwarded-host")),
    readHostname
  );
}

/**
 * Adds an expiry for the host-only session cookie to a response that sets or
 * clears the shared session cookie, when that cookie reaches the host that
 * answered. Both cookies have the same name, and the browser sends the older
 * host-only cookie first, so while both exist the older one is read. The expiry
 * has no Domain attribute, so the browser applies it only to the host that
 * answered. A host that the shared cookie does not reach keeps its own cookie,
 * so a session that cookie holds there still works.
 *
 * Returns `undefined` when the response leaves the session cookie alone.
 */
export function expireHostOnlySessionCookie(
  response: Response,
  {
    cookieDomain,
    hostname,
    name,
  }: {
    readonly cookieDomain: string;
    readonly hostname: string;
    readonly name: string;
  }
) {
  if (!sharedCookieReaches(hostname, cookieDomain)) {
    return;
  }
  const setCookies = response.headers.getSetCookie();
  if (!Arr.some(setCookies, (entry) => entry.startsWith(`${name}=`))) {
    return;
  }

  const secure = name.startsWith("__Secure-") ? "; Secure" : "";
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  // A browser applies a response's cookies in order. The expiry comes first, so
  // when the browser stores both cookies as one cookie, as Chromium does for
  // localhost, the shared cookie that follows is the one that remains.
  headers.append(
    "set-cookie",
    `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`
  );
  for (const cookie of setCookies) {
    headers.append("set-cookie", cookie);
  }
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

/**
 * Wraps Better Auth's request handler with `expireHostOnlySessionCookie`. A
 * plugin's response hook receives the auth context and not the request, so the
 * host that answered is read here, from the request.
 */
export function hostOnlySessionCookieHandler(
  handler: (request: Request) => Promise<Response>,
  siteUrl: URL
) {
  const name = readHostOnlySessionCookieName(siteUrl);
  return (request: Request): Promise<Response> =>
    Effect.promise(() => handler(request)).pipe(
      Effect.map((response) => {
        const hostname = readBrowserHostname(request);
        if (Option.isNone(hostname)) {
          return response;
        }
        return (
          expireHostOnlySessionCookie(response, {
            cookieDomain: siteUrl.hostname,
            hostname: hostname.value,
            name,
          }) ?? response
        );
      }),
      Effect.runPromise
    );
}
