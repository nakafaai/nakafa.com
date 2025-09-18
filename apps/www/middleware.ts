import { internationalizationMiddleware } from "@repo/internationalization/middleware";
import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const authRoutes = ["/auth"];
const protectedRoutes = ["/settings", "/chat"];
const localeRegex = /^\/[a-z]{2}(?=\/|$)/;
const authPathRegex = /\/auth.*$/;
const lastSegmentRegex = /\/[^/]+$/;

export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const pathname = request.nextUrl.pathname;

  // Extract locale from pathname (e.g., /en/auth -> /auth)
  const pathnameWithoutLocale = pathname.replace(localeRegex, "") || "/";

  const isAuthRoute = authRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );

  // If user has session and tries to access auth routes, redirect to home
  if (sessionCookie && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(authPathRegex, "");
    return NextResponse.redirect(url);
  }

  // If user has no session and tries to access protected routes, redirect to auth
  if (!sessionCookie && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(lastSegmentRegex, "/auth");
    return NextResponse.redirect(url);
  }

  // Continue with internationalization middleware
  return internationalizationMiddleware(request);
}

export const config = {
  matcher: [
    // Run middleware on all routes except static assets and ALL API routes
    "/((?!_next/static|_pagefind|fonts|open-graph|api|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|css|webmanifest|xml|txt)$).*)",
  ],
};
