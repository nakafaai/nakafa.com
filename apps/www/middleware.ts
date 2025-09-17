import { internationalizationMiddleware } from "@repo/internationalization/middleware";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  return internationalizationMiddleware(request);
}

export const config = {
  matcher: [
    // Run middleware on all routes except static assets and ALL API routes
    "/((?!_next/static|_pagefind|fonts|open-graph|api|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|css|webmanifest|xml|txt)$).*)",
  ],
};
