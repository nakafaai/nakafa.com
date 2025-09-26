import { internationalizationMiddleware } from "@repo/internationalization/middleware";
import { domainRedirectMiddleware } from "@repo/next-config/middleware/domain-redirect";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // First, handle domain-based redirects for SEO domains
  const domainResponse = domainRedirectMiddleware(request);

  // If domain middleware handled the request (redirect, rewrite, or sitemap), use it
  if (domainResponse) {
    return domainResponse;
  }

  // Continue with internationalization middleware for main domain
  return internationalizationMiddleware(request);
}

export const config = {
  matcher: [
    // Run middleware on all routes except static assets and ALL API routes
    "/((?!_next/static|_pagefind|fonts|open-graph|api|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|css|webmanifest|xml|txt)$).*)",
  ],
};
