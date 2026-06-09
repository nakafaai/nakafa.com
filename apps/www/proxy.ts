import { isPostHogProxyPathname } from "@repo/analytics/posthog/config";
import {
  getPublicContentRouteCheck,
  type PublicContentRouteCheck,
} from "@repo/contents/_lib/manifest/public-route";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import type { ProxyConfig } from "next/server";
import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import {
  AGENT_DISCOVERY_LINK_HEADER,
  LLMS_TEXT_PATH,
} from "@/lib/agent-discovery";
import {
  fetchRuntimeContentRoute,
  fetchRuntimeContentRoutesByKindPage,
  fetchRuntimeContentRoutesByParentPage,
} from "@/lib/content/runtime";

type RuntimeRoutePage =
  | Awaited<ReturnType<typeof fetchRuntimeContentRoutesByKindPage>>
  | Awaited<ReturnType<typeof fetchRuntimeContentRoutesByParentPage>>;
type VerifiedContentRouteCheck = Exclude<
  PublicContentRouteCheck,
  { mode: "outside" }
>;

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
]);

/**
 * Run locale routing while leaving the same-origin PostHog proxy untouched.
 * Public content route existence is checked before rendering so missing
 * matched content URLs return a real 404 instead of a streamed soft 404.
 *
 * References:
 * https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 * https://posthog.com/docs/advanced/proxy/nextjs
 */
export async function proxy(request: NextRequest) {
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
    const routeCheck = getPublicContentRouteCheck(localizedContentRoute.route);

    if (routeCheck.mode === "outside") {
      request.cookies.set(AUTH_REDIRECT_PATH_COOKIE, pathname);

      const response = handleLocalizedRequest(request);
      response.headers.append("Link", AGENT_DISCOVERY_LINK_HEADER);
      response.headers.set("X-Llms-Txt", LLMS_TEXT_PATH);

      return response;
    }

    if (shouldVerifyContentRoute(request)) {
      const exists = await contentRouteExists(
        localizedContentRoute.locale,
        routeCheck
      );

      if (!exists) {
        return rewriteToContentNotFound(request, localizedContentRoute.locale);
      }
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

/** Returns one localized route, stripped of markdown suffixes. */
function getLocalizedContentRoute(pathname: string) {
  const [rawLocale, ...routeSegments] = pathname.split("/").filter(Boolean);
  const locale = getSupportedLocale(rawLocale);

  if (!locale) {
    return null;
  }

  const rawRoute = `/${routeSegments.join("/")}`;
  const markdownExtension =
    rawRoute.match(MARKDOWN_EXTENSION_PATTERN)?.[0] ?? "";
  const route = rawRoute.replace(MARKDOWN_EXTENSION_PATTERN, "");

  return {
    locale,
    markdownExtension,
    route,
  };
}

/** Returns one supported locale segment without widening it to any string. */
function getSupportedLocale(locale: string | undefined) {
  for (const supportedLocale of routing.locales) {
    if (supportedLocale === locale) {
      return supportedLocale;
    }
  }

  return null;
}

/** Returns whether one request should reject missing public content routes. */
function shouldVerifyContentRoute(request: NextRequest) {
  return request.method === "GET" || request.method === "HEAD";
}

/** Checks one public content route with the narrowest bounded catalog read. */
function contentRouteExists(
  locale: (typeof routing.locales)[number],
  routeCheck: VerifiedContentRouteCheck
) {
  if (routeCheck.mode === "app") {
    return Promise.resolve(true);
  }

  if (routeCheck.mode === "missing") {
    return Promise.resolve(false);
  }

  if (routeCheck.mode === "exact") {
    return exactContentRouteExists({ locale, route: routeCheck.route });
  }

  if (routeCheck.mode === "article-category") {
    return contentRoutePageHasRows(() =>
      fetchRuntimeContentRoutesByParentPage({
        cursor: null,
        kind: "article",
        limit: 1,
        locale,
        order: "date-desc",
        parentRoute: routeCheck.parentRoute,
        section: "articles",
      })
    );
  }

  if (routeCheck.mode === "exercise-type") {
    return contentRoutePageHasRows(() =>
      fetchRuntimeContentRoutesByKindPage({
        cursor: null,
        kind: "exercise-group",
        limit: 1,
        locale,
        prefix: routeCheck.prefix,
        section: "exercises",
      })
    );
  }

  if (routeCheck.mode === "exercise-material") {
    return contentRoutePageHasRows(() =>
      fetchRuntimeContentRoutesByParentPage({
        cursor: null,
        kind: "exercise-group",
        limit: 1,
        locale,
        order: "route",
        parentRoute: routeCheck.parentRoute,
        section: "exercises",
      })
    );
  }

  if (routeCheck.mode === "subject-grade") {
    return contentRoutePageHasRows(() =>
      fetchRuntimeContentRoutesByKindPage({
        cursor: null,
        kind: "subject-topic",
        limit: 1,
        locale,
        prefix: routeCheck.prefix,
        section: "subject",
      })
    );
  }

  return contentRoutePageHasRows(() =>
    fetchRuntimeContentRoutesByParentPage({
      cursor: null,
      kind: "subject-topic",
      limit: 1,
      locale,
      order: "route",
      parentRoute: routeCheck.parentRoute,
      section: "subject",
    })
  );
}

/** Reads one catalog probe and fails open on transient read errors. */
function contentRoutePageHasRows(readPage: () => Promise<RuntimeRoutePage>) {
  return Effect.runPromise(
    Effect.tryPromise(readPage).pipe(
      Effect.match({
        onFailure: () => true,
        onSuccess: (page) => page.page.length > 0,
      })
    )
  );
}

/** Reads the exact Convex route row and fails open on transient read errors. */
function exactContentRouteExists({
  locale,
  route,
}: {
  locale: (typeof routing.locales)[number];
  route: string;
}) {
  return Effect.runPromise(
    Effect.tryPromise(() => fetchRuntimeContentRoute({ locale, route })).pipe(
      Effect.match({
        onFailure: () => true,
        onSuccess: (contentRoute) => contentRoute !== null,
      })
    )
  );
}

/** Rewrites missing content to the styled app not-found route with 404 status. */
function rewriteToContentNotFound(
  request: NextRequest,
  locale: (typeof routing.locales)[number]
) {
  const rewriteUrl = new URL(`/${locale}/_not-found`, request.url);

  return NextResponse.rewrite(rewriteUrl, {
    headers: {
      "X-Robots-Tag": "noindex",
    },
    status: 404,
  });
}

export const config: ProxyConfig = {
  matcher: [
    "/((?!_next/static|fonts|open-graph|api|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|gltf|bin|ktx2|hdr|exr|js|css|xml|webmanifest|txt)$).*)",
  ],
};
