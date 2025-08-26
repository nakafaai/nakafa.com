import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { internationalizationMiddleware } from "@repo/internationalization/middleware";

const DAYS = 30;
const MAX_AGE = 60 * 60 * 24 * DAYS;

const isAuthPage = createRouteMatcher(["/auth"]);
const isSettingsPage = createRouteMatcher(["/settings"]);

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const isAuthenticated = await convexAuth.isAuthenticated();

    const isAuth = isAuthPage(request);
    const isSettings = isSettingsPage(request);

    if (isAuth && isAuthenticated) {
      return nextjsMiddlewareRedirect(request, "/");
    }

    if (isSettings && !isAuthenticated) {
      return nextjsMiddlewareRedirect(request, "/auth");
    }

    return internationalizationMiddleware(request);
  },
  {
    cookieConfig: { maxAge: MAX_AGE },
    verbose: true,
  }
);

export const config = {
  matcher: [
    "/((?!_next/static|_pagefind|fonts|open-graph|api|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|css|webmanifest|xml|txt)$).*)",

    // all routes except static assets and /api/chat
    "/((?!.*\\..*|_next|api/chat).*)",
    // Include all API and TRPC routes except /api/chat
    "/(api(?!/chat)|trpc)(.*)",
  ],
};
