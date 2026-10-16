import { getCookies } from "better-auth/cookies";
import { Array as Arr, Effect } from "effect";

/**
 * The origins that a site trusts for its sign-in: each school host of the site,
 * such as `https://*.nakafa.com`, so that a school host may post to the shared
 * sign-in (ADR 0009). A site with a port also trusts its own host on any port,
 * because a local run serves on a port that `SITE_URL` does not name.
 */
export function readSchoolTrustedOrigins(siteUrl: URL) {
  const { hostname, port, protocol } = siteUrl;
  if (port === "") {
    return [`${protocol}//*.${hostname}`];
  }
  return [`${protocol}//*.${hostname}:*`, `${protocol}//${hostname}:*`];
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
 * shared cookie of the site reaches, so the answer is `undefined`.
 */
function readBrowserHostname(request: Request) {
  const host = request.headers.get("x-forwarded-host");
  if (host === null || !URL.canParse(`http://${host}`)) {
    return;
  }
  return new URL(`http://${host}`).hostname;
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
        if (hostname === undefined) {
          return response;
        }
        return (
          expireHostOnlySessionCookie(response, {
            cookieDomain: siteUrl.hostname,
            hostname,
            name,
          }) ?? response
        );
      }),
      Effect.runPromise
    );
}
