import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";
import { internationalizationMiddleware } from "@repo/internationalization/middleware";

const DAYS = 30;
const MAX_AGE = 60 * 60 * 24 * DAYS;

export default convexAuthNextjsMiddleware(internationalizationMiddleware, {
  cookieConfig: { maxAge: MAX_AGE },
  verbose: true,
});

export const config = {
  matcher: [
    "/((?!_next/static|_pagefind|api|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|css|webmanifest|xml|txt)$).*)",

    // all routes except static assets and /api/chat
    "/((?!.*\\..*|_next|api/chat).*)",
    // Include all API and TRPC routes except /api/chat
    "/(api(?!/chat)|trpc)(.*)",
  ],
};
