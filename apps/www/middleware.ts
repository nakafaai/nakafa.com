import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";
import { internationalizationMiddleware } from "@repo/internationalization/middleware";

const DAYS = 30;
const MAX_AGE = 60 * 60 * 24 * DAYS;

export default convexAuthNextjsMiddleware(internationalizationMiddleware, {
  cookieConfig: { maxAge: MAX_AGE },
  verbose: true,
});

export const config = {
  matcher:
    "/((?!api|trpc|_next|_vercel|manifest|webmanifest|sitemap|.*\\..*).*)",
};
