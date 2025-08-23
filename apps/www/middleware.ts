import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";
import { internationalizationMiddleware } from "@repo/internationalization/middleware";

export default convexAuthNextjsMiddleware(internationalizationMiddleware);

export const config = {
  matcher:
    "/((?!api|trpc|_next|_vercel|manifest|webmanifest|sitemap|.*\\..*).*)",
};
