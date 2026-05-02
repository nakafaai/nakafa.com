import { env } from "@/env";

const MCP_ENDPOINT = new URL("/mcp", env.NEXT_PUBLIC_MCP_URL);

const CONNECTION_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const REQUEST_MANAGED_HEADERS = new Set(["content-length", "host"]);

const FETCH_DECODED_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
]);

/** Copies request headers while removing proxy-managed headers. */
function getForwardHeaders(request: Request) {
  const headers = new Headers(request.headers);

  for (const header of [...CONNECTION_HEADERS, ...REQUEST_MANAGED_HEADERS]) {
    headers.delete(header);
  }

  return headers;
}

/** Forwards MCP HTTP requests to the configured MCP service. */
async function proxyMcpRequest(request: Request) {
  const upstreamUrl = new URL(MCP_ENDPOINT);
  upstreamUrl.search = new URL(request.url).search;

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  try {
    const upstream = await fetch(upstreamUrl, {
      body,
      cache: "no-store",
      headers: getForwardHeaders(request),
      method: request.method,
      redirect: "manual",
    });
    const headers = new Headers(upstream.headers);

    for (const header of [
      ...CONNECTION_HEADERS,
      ...FETCH_DECODED_RESPONSE_HEADERS,
    ]) {
      headers.delete(header);
    }

    return new Response(upstream.body, {
      headers,
      status: upstream.status,
      statusText: upstream.statusText,
    });
  } catch {
    return new Response("MCP upstream is unavailable", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
      status: 502,
    });
  }
}

export const GET = proxyMcpRequest;
export const POST = proxyMcpRequest;
export const DELETE = proxyMcpRequest;
export const OPTIONS = proxyMcpRequest;
