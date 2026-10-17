import { Option } from "effect";
import type { NextRequest } from "next/server";
import { readRequestHost } from "@/lib/routing/school/host";

/**
 * The URL that the visitor asked for, which the proxy names in its redirects: the
 * protocol, path and query of the request URL, with the host and port that the
 * Host header names. A self-hosted server builds the request URL from its own
 * address (ADR 0026), so the request URL can name another host and another port
 * than the visitor's, behind a reverse proxy, a port mapping or a tunnel. Its
 * protocol is already the visitor's: Next.js writes `https` when the connection is
 * TLS or `x-forwarded-proto` names `https` (`resolve-routes.js` in
 * `next/dist/server/lib/router-utils`, line 116), and on Vercel always. A Host
 * header without a port names the default port of the protocol, which is the port
 * that the browser used. A request without a usable Host header keeps the host and
 * port of its URL.
 *
 * A rewrite never uses this URL. Next proxies a rewrite to any origin other than
 * the server's own, so a rewrite names the request URL, the origin that the
 * middleware sees.
 */
export function readVisitorUrl(request: NextRequest) {
  const url = new URL(request.url);
  const host = readRequestHost(request.headers);
  if (Option.isSome(host)) {
    const visitor = new URL(`${url.protocol}//${host.value}`);
    url.hostname = visitor.hostname;
    // The hostname setter keeps the server's port, so the port is set as well.
    url.port = visitor.port;
  }
  return url;
}
