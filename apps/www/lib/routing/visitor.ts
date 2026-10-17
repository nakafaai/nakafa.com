import { Option } from "effect";
import type { NextRequest } from "next/server";
import { readRequestHostname } from "@/lib/routing/school/host";

/**
 * The URL that the visitor asked for, which the proxy names in its redirects: the
 * protocol, port, path and query of the request URL, with the host that the Host
 * header names. A self-hosted server builds the request URL from its own address
 * (ADR 0026), so the request URL can name another host than the visitor's. A
 * request without a usable Host header keeps the host of its URL.
 *
 * A rewrite never uses this URL. Next proxies a rewrite to any origin other than
 * the server's own, so a rewrite names the request URL, the origin that the
 * middleware sees.
 */
export function readVisitorUrl(request: NextRequest) {
  const url = new URL(request.url);
  const hostname = readRequestHostname(request.headers);
  if (Option.isSome(hostname)) {
    url.hostname = hostname.value;
  }
  return url;
}
