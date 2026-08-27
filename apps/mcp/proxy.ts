import {
  NAKAFA_MCP_EDGE_CONTRACT,
  setAgentEdgeReleaseHeader,
  VERCEL_GIT_COMMIT_SHA_ENVIRONMENT,
} from "@repo/backend/agent/edge";
import type { NextRequest, ProxyConfig } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/env";

const MCP_REQUEST_HEADERS = new Set([
  "accept",
  "accept-language",
  "access-control-request-headers",
  "access-control-request-method",
  "baggage",
  "content-encoding",
  "content-type",
  "last-event-id",
  "mcp-method",
  "mcp-name",
  "mcp-protocol-version",
  "mcp-session-id",
  "origin",
  "traceparent",
  "tracestate",
  "user-agent",
  "x-forwarded-for",
]);

/** Rewrites the public MCP transport to its protected Convex origin. */
export function proxy(request: NextRequest) {
  const destination = new URL(
    NAKAFA_MCP_EDGE_CONTRACT.originPath,
    env[NAKAFA_MCP_EDGE_CONTRACT.originEnvironment]
  );
  destination.search = request.nextUrl.search;
  const headers = new Headers();
  for (const [header, value] of request.headers) {
    const normalized = header.toLowerCase();
    if (
      MCP_REQUEST_HEADERS.has(normalized) ||
      normalized.startsWith("mcp-param-")
    ) {
      headers.set(header, value);
    }
  }
  headers.set(
    NAKAFA_MCP_EDGE_CONTRACT.secretHeader,
    env[NAKAFA_MCP_EDGE_CONTRACT.secretEnvironment]
  );
  const response = NextResponse.rewrite(destination, { request: { headers } });
  setAgentEdgeReleaseHeader(
    response.headers,
    env[VERCEL_GIT_COMMIT_SHA_ENVIRONMENT]
  );
  return response;
}

export const config: ProxyConfig = {
  matcher: ["/mcp"],
};
