import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./src/routing";

export function internationalizationMiddleware(request: NextRequest) {
  return createMiddleware(routing)(request);
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  // - … if they contain `manifest`, `webmanifest`, or `sitemap`
  matcher:
    "/((?!api|trpc|_next|_vercel|manifest|webmanifest|sitemap|.*\\..*).*)",
};
