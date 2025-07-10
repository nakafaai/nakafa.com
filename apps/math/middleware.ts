import { internationalizationMiddleware } from "@repo/internationalization/middleware";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  return internationalizationMiddleware(request);
}

export const config = {
  matcher:
    "/((?!api|trpc|_next|_vercel|manifest|webmanifest|sitemap|.*\\..*).*)",
};
