import { routing } from "@repo/internationalization/src/routing";
import createMiddleware from "next-intl/middleware";

export default createMiddleware(routing);

export const config = {
  matcher: [
    "/((?!_next/static|_pagefind|fonts|open-graph|api|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|css|xml|webmanifest|txt)$).*)",
  ],
};
