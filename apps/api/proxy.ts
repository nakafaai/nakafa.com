import { timingSafeEqual } from "@repo/utilities/security";
import type { NextRequest, ProxyConfig } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/env";

/**
 * Middleware for securing Contents API.
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

/**
 * Middleware configuration for route matching.
 *
 * Only applies to /contents/* routes.
 */
export const config: ProxyConfig = {
  matcher: ["/contents/:path*"],
};
