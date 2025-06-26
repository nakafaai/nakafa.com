import { type NextRequest, NextResponse } from "next/server";

export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher:
    "/((?!api|v1|trpc|_next|_vercel|manifest|webmanifest|sitemap|.*\\..*).*)",
};
