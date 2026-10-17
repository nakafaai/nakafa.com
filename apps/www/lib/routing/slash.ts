import { type NextRequest, NextResponse } from "next/server";
import { readVisitorUrl } from "@/lib/routing/visitor";

const TRAILING_SLASH_PATTERN = /\/+$/;

/**
 * Redirects a path with a trailing slash to its one canonical spelling, as a 308,
 * on the host that the visitor asked for (see `readVisitorUrl`).
 */
export function redirectTrailingSlash(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.length <= 1 || !pathname.endsWith("/")) {
    return null;
  }

  const redirectUrl = readVisitorUrl(request);
  redirectUrl.pathname = pathname.replace(TRAILING_SLASH_PATTERN, "");

  return NextResponse.redirect(redirectUrl, 308);
}
