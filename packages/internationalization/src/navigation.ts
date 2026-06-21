import { routing } from "@repo/internationalization/src/routing";
import { createNavigation } from "next-intl/navigation";

// Lightweight wrappers around Next.js' navigation APIs
// that preserve the app-wide route surface. Localized public route pathnames
// stay in routing.ts for middleware/proxy matching and route projection.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation({
    defaultLocale: routing.defaultLocale,
    locales: routing.locales,
  });
