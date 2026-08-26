import { NAKAFA_API_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { timingSafeEqual } from "@repo/utilities/security";
import type { NextRequest, ProxyConfig } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/env";

const CONTENT_PATH_PREFIX = "/contents/";
const AGENT_API_REQUEST_HEADERS = new Set([
  "accept",
  "accept-encoding",
  "accept-language",
  "access-control-request-headers",
  "access-control-request-method",
  "baggage",
  "if-none-match",
  "origin",
  "traceparent",
  "tracestate",
  "user-agent",
  "x-forwarded-for",
]);

/**
 * Bridges the public agent API and protects private content routes.
 *
 * Security model: Server-side only.
 * - No CORS headers (blocks browser access)
 * - Requires valid Bearer token for all requests
 * - Uses timing-safe comparison to prevent timing attacks
 *
 * @param request - The incoming Next.js request
 * @returns NextResponse to continue or 401 error
 */
export function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith(CONTENT_PATH_PREFIX)) {
    return rewriteAgentApi(request);
  }

  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const providedKey = authHeader.slice(7);
  const validKey = env.INTERNAL_CONTENT_API_KEY;

  if (!(validKey && timingSafeEqual(providedKey, validKey))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

/** Rewrites one public API request to the protected Convex origin. */
function rewriteAgentApi(request: NextRequest) {
  const destination = new URL(
    `${NAKAFA_API_EDGE_CONTRACT.originPath}${request.nextUrl.pathname}`,
    env.NEXT_PUBLIC_CONVEX_SITE_URL
  );
  destination.search = request.nextUrl.search;
  const headers = new Headers();
  for (const [header, value] of request.headers) {
    if (AGENT_API_REQUEST_HEADERS.has(header.toLowerCase())) {
      headers.set(header, value);
    }
  }
  headers.set(
    NAKAFA_API_EDGE_CONTRACT.secretHeader,
    env[NAKAFA_API_EDGE_CONTRACT.secretEnvironment]
  );
  return NextResponse.rewrite(destination, { request: { headers } });
}

/**
 * Middleware configuration for route matching.
 *
 * Applies only to private content and public agent API routes.
 */
export const config: ProxyConfig = {
  matcher: ["/contents/:path*", "/openapi.json", "/v1/:path*"],
};
