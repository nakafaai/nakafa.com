import { isPostHogProxyPathname } from "@repo/analytics/posthog/config";
import {
  hasInvalidTryOutYearSlug,
  LEGACY_YEARLESS_TRY_OUT_REDIRECT_YEAR,
} from "@repo/contents/_lib/exercises/slug";
import { routing } from "@repo/internationalization/src/routing";
import type { ProxyConfig } from "next/server";
import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import {
  AGENT_DISCOVERY_LINK_HEADER,
  LLMS_TEXT_PATH,
} from "@/lib/agent-discovery";
import {
  getPublicContentRedirects,
  getPublicContentRequestRoutes,
  getPublicContentRouteRoots,
} from "@/lib/sitemap/routes";

const handleLocalizedRequest = createMiddleware(routing);
const TRAILING_SLASH_PATTERN = /\/+$/;
const MARKDOWN_EXTENSION_PATTERN = /\.mdx?$/;
const AUTH_REDIRECT_PATH_COOKIE = "auth-redirect-path";
const LOCALE_BYPASS_PATHS = new Set([
  "/mcp",
  "/llms.txt",
  "/llms-full.txt",
  "/skill.md",
  "/.well-known/llms.txt",
  "/.well-known/llms-full.txt",
  "/.well-known/agent-skills/index.json",
  "/.well-known/agent-skills/nakafa/SKILL.md",
  "/.well-known/skills/index.json",
  "/.well-known/skills/nakafa/SKILL.md",
  "/.well-known/skills/nakafa/skill.md",
]);
const requestRoutes = new Set(getPublicContentRequestRoutes());
const contentRedirects = new Map(getPublicContentRedirects());
const publicContentRouteRoots = new Set(getPublicContentRouteRoots());

/**
 * Run locale routing while leaving the same-origin PostHog proxy untouched.
 *
 * References:
 * https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 * https://posthog.com/docs/advanced/proxy/nextjs
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPostHogProxyPathname(pathname)) {
    return NextResponse.next();
  }

  if (pathname.length > 1 && pathname.endsWith("/")) {
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = pathname.replace(TRAILING_SLASH_PATTERN, "");

    return NextResponse.redirect(redirectUrl, 308);
  }

  if (isLocaleBypassPath(pathname)) {
    return NextResponse.next();
  }

  const localizedContentRoute = getLocalizedContentRoute(pathname);

  if (localizedContentRoute) {
    const legacyRedirectPath = getLegacyTryOutRedirectPath(
      localizedContentRoute.locale,
      localizedContentRoute.route,
      localizedContentRoute.markdownExtension
    );

    if (legacyRedirectPath) {
      const redirectUrl = new URL(request.url);
      redirectUrl.pathname = legacyRedirectPath;

      return NextResponse.redirect(redirectUrl, 308);
    }

    const contentRedirectPath = getPublicContentRedirectPath(
      localizedContentRoute.locale,
      localizedContentRoute.route,
      localizedContentRoute.markdownExtension
    );

    if (contentRedirectPath) {
      const redirectUrl = new URL(request.url);
      redirectUrl.pathname = contentRedirectPath;

      return NextResponse.redirect(redirectUrl, 308);
    }

    if (!requestRoutes.has(localizedContentRoute.route)) {
      const rewriteUrl = new URL(request.url);
      rewriteUrl.pathname = `/${localizedContentRoute.locale}/__not-found`;

      return NextResponse.rewrite(rewriteUrl, {
        headers: {
          Link: AGENT_DISCOVERY_LINK_HEADER,
          "X-Llms-Txt": LLMS_TEXT_PATH,
          "x-robots-tag": "noindex",
        },
        status: 404,
      });
    }

    if (
      localizedContentRoute.markdownExtension ||
      request.headers.get("accept")?.includes("text/markdown")
    ) {
      const rewriteUrl = new URL(request.url);
      rewriteUrl.pathname = `/llms.mdx/${localizedContentRoute.locale}${localizedContentRoute.route}`;

      return NextResponse.rewrite(rewriteUrl);
    }
  }

  request.cookies.set(AUTH_REDIRECT_PATH_COOKIE, pathname);

  const response = handleLocalizedRequest(request);
  response.headers.append("Link", AGENT_DISCOVERY_LINK_HEADER);
  response.headers.set("X-Llms-Txt", LLMS_TEXT_PATH);

  return response;
}

/** Returns whether one public AI/system path should skip locale routing. */
function isLocaleBypassPath(pathname: string) {
  return (
    LOCALE_BYPASS_PATHS.has(pathname) || pathname.startsWith("/llms-full/")
  );
}

/** Returns the canonical target for content routes that intentionally redirect. */
function getPublicContentRedirectPath(
  locale: string,
  route: string,
  markdownExtension: string
) {
  const targetRoute = contentRedirects.get(route);

  if (!targetRoute) {
    return null;
  }

  return `/${locale}${targetRoute}${markdownExtension}`;
}

/** Returns one localized public content route, stripped of markdown suffixes. */
function getLocalizedContentRoute(pathname: string) {
  const [locale, ...routeSegments] = pathname.split("/").filter(Boolean);

  if (!routing.locales.some((supportedLocale) => supportedLocale === locale)) {
    return null;
  }

  const rawRoute = `/${routeSegments.join("/")}`;
  const markdownExtension =
    rawRoute.match(MARKDOWN_EXTENSION_PATTERN)?.[0] ?? "";
  const route = rawRoute.replace(MARKDOWN_EXTENSION_PATTERN, "");

  if (!isPublicContentRoute(route)) {
    return null;
  }

  return {
    locale,
    markdownExtension,
    route,
  };
}

/** Returns whether one localized route belongs to public educational content. */
function isPublicContentRoute(route: string) {
  const [root] = route.split("/").filter(Boolean);

  return root !== undefined && publicContentRouteRoots.has(`/${root}`);
}

/** Builds the canonical redirect target for migrated yearless try-out routes. */
function getLegacyTryOutRedirectPath(
  locale: string,
  route: string,
  markdownExtension: string
) {
  const routeSegments = route.split("/").filter(Boolean);
  const [routeBase, category, type, material, ...slug] = routeSegments;

  if (routeBase !== "exercises" || !(category && type && material)) {
    return null;
  }

  if (!hasInvalidTryOutYearSlug(slug)) {
    return null;
  }

  const canonicalSlug = [
    "try-out",
    LEGACY_YEARLESS_TRY_OUT_REDIRECT_YEAR,
    ...slug.slice(1),
  ];
  const canonicalRoute = [
    routeBase,
    category,
    type,
    material,
    ...canonicalSlug,
  ].join("/");

  return `/${locale}/${canonicalRoute}${markdownExtension}`;
}

export const config: ProxyConfig = {
  matcher: [
    "/((?!_next/static|_pagefind|fonts|open-graph|api|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|css|xml|webmanifest|txt)$).*)",
  ],
};
