import { routing } from "@repo/internationalization/src/routing";
import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { hasLocale } from "next-intl";

/**
 * Resolves the optimistic sign-in redirect for a protected School request.
 * Convex functions and server data seams still own authorization.
 */
export function readSchoolAuthRedirect(request: NextRequest) {
  const routeSegments = request.nextUrl.pathname.split("/").filter(Boolean);
  const firstSegment = routeSegments[0];
  const hasLocalePrefix =
    firstSegment !== undefined && hasLocale(routing.locales, firstSegment);
  const schoolSegments = hasLocalePrefix
    ? routeSegments.slice(1)
    : routeSegments;

  if (schoolSegments[0] !== "school" || schoolSegments.length === 1) {
    return null;
  }

  if (getSessionCookie(request)) {
    return null;
  }

  const locale = hasLocalePrefix ? firstSegment : routing.defaultLocale;
  const redirectPathname = hasLocalePrefix
    ? request.nextUrl.pathname
    : `/${locale}${request.nextUrl.pathname}`;
  const redirectUrl = new URL(`/${locale}/auth`, request.url);
  redirectUrl.searchParams.set(
    "redirect",
    `${redirectPathname}${request.nextUrl.search}`
  );

  return redirectUrl;
}
