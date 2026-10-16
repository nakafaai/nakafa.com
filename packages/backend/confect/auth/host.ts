import { getCookies, splitSetCookieHeader } from "better-auth/cookies";
import { Array as Arr } from "effect";

/**
 * The origins of the school hosts of a site, such as `https://*.nakafa.com`, so
 * that a school host may post to the shared sign-in. A local site with a port
 * admits `*.localhost` on that port.
 */
export function readSchoolTrustedOrigins(siteUrl: URL) {
  const port = siteUrl.port === "" ? "" : ":*";
  return [`${siteUrl.protocol}//*.${siteUrl.hostname}${port}`];
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
 * Adds an expiry for the host-only session cookie to a response that sets or
 * clears the shared session cookie. Both cookies have the same name. The browser
 * sends the older cookie first, and the identity route reads the first value of
 * a name, so while both exist the older host-only cookie is the one read. The
 * expiry has no Domain attribute, so the browser applies it only to the host
 * that answered. A response from a school host therefore cannot expire the main
 * site's cookie, which is why only a main-site response may write the shared
 * cookie (ADR 0009).
 *
 * Returns `undefined` when the response does not touch the session cookie.
 */
export function expireHostOnlySessionCookie(response: Response, name: string) {
  const setCookies = splitSetCookieHeader(
    response.headers.get("set-cookie") ?? ""
  );
  if (!Arr.some(setCookies, (entry) => entry.startsWith(`${name}=`))) {
    return;
  }

  const secure = name.startsWith("__Secure-") ? "; Secure" : "";
  const headers = new Headers(response.headers);
  headers.append(
    "set-cookie",
    `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`
  );
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

/** The Better Auth plugin that runs `expireHostOnlySessionCookie` on every response. */
export function hostOnlySessionCookiePlugin(name: string) {
  return {
    id: "host-only-session-cookie",
    onResponse: (response: Response) => {
      const expired = expireHostOnlySessionCookie(response, name);
      return Promise.resolve(
        expired === undefined ? undefined : { response: expired }
      );
    },
  };
}
