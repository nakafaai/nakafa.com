import { type NextRequest, NextResponse } from "next/server";

const allowedOrigins = [
  "http://localhost:3000", // Development - www app
  "http://localhost:3001", // Development - mcp app
  "http://localhost:3002", // Development - api app
  "http://localhost:3003", // Development - math app
  "https://nakafa.com", // Production
  "https://www.nakafa.com", // Production with www
];

const corsOptions = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function middleware(request: NextRequest) {
  // Check the origin from the request
  const origin = request.headers.get("origin") ?? "";
  const isAllowedOrigin = allowedOrigins.includes(origin);

  // Handle preflight requests
  const isPreflight = request.method === "OPTIONS";

  if (isPreflight) {
    const preflightHeaders = {
      ...(isAllowedOrigin && { "Access-Control-Allow-Origin": origin }),
      ...corsOptions,
    };
    return NextResponse.json({}, { headers: preflightHeaders });
  }

  // Handle simple requests
  const response = NextResponse.next();

  if (isAllowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }

  for (const [key, value] of Object.entries(corsOptions)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: ["/health", "/contents/:path*"],
};
