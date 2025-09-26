import { getAllSeoDomains } from "@repo/next-config/domains";
import { CorsValidator } from "@repo/security";
import { type NextRequest, NextResponse } from "next/server";

const corsValidator = new CorsValidator({
  seoDomains: getAllSeoDomains(),
});

export function middleware(request: NextRequest) {
  // Check the origin from the request
  const origin = request.headers.get("origin") ?? "";
  const isAllowedOrigin = corsValidator.isOriginAllowed(origin);

  // Handle preflight requests
  const isPreflight = request.method === "OPTIONS";

  if (isPreflight) {
    const corsHeaders = corsValidator.getCorsHeaders(origin);
    return NextResponse.json({}, { headers: corsHeaders });
  }

  // Handle simple requests
  const response = NextResponse.next();

  // Set CORS headers for allowed origins
  if (isAllowedOrigin) {
    const corsHeaders = corsValidator.getCorsHeaders(origin);
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

export const config = {
  matcher: ["/health", "/contents/:path*"],
};
