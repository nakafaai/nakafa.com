import { Effect } from "effect";
import { HttpClientRequest } from "effect/http";
import { readSessionCookie } from "@/lib/auth/cookie.server";
import { requestSessionToken, TOKEN_PATH } from "@/lib/auth/token";

/**
 * Builds the headers of one Convex token request. The request forwards no body,
 * so the framing headers go; `accept-encoding` is `identity`, so the response is
 * read as sent; and `host` names the Convex site.
 */
function tokenRequestHeaders(site: URL, requestHeaders: Headers) {
  const headers = new Headers(requestHeaders);
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  headers.set("accept-encoding", "identity");
  headers.set("host", site.host);
  return headers;
}

/**
 * Reads the Better Auth Convex token for one request on the server. Without a
 * session cookie no request is sent and the token is `undefined`. Otherwise the
 * request forwards the visitor's headers to the token route of the Convex site.
 */
export const readSessionToken = Effect.fn("www.auth.readSessionToken")(
  function* (siteUrl: string, requestHeaders: Headers) {
    if (readSessionCookie(requestHeaders) === null) {
      return;
    }
    const site = new URL(siteUrl);
    return yield* requestSessionToken(
      HttpClientRequest.get(new URL(TOKEN_PATH, site), {
        headers: tokenRequestHeaders(site, requestHeaders),
      })
    );
  }
);
