import {
  APP_LOCALE_CODES,
  type AppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import { isPostHogProxyPathname } from "@repo/analytics/posthog/config";
import {
  previewRouting,
  routing,
} from "@repo/internationalization/src/routing";
import { mergeVaryHeader } from "@repo/utilities/http/accept";
import { getSessionCookie } from "better-auth/cookies";
import { Effect, Option } from "effect";
import type { ProxyConfig } from "next/server";
import { type NextRequest, NextResponse } from "next/server";
import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import { hasTryoutAttemptCapability } from "@/components/tryout/route/path";
import {
  AGENT_DISCOVERY_LINK_HEADER,
  LLMS_TEXT_PATH,
} from "@/lib/agent-discovery";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import {
  matchesInternalPreviewRoute,
  matchesPreviewPathname,
} from "@/lib/content/preview/route";
import {
  LLMS_REPRESENTATION_VARY_FIELDS,
  type LocalizedLlmsRoute,
  readLlmsMarkdownPathname,
} from "@/lib/llms/routes";
import { isOgRouteAliasPathname } from "@/lib/og/route";
import {
  isLocaleBypassPath,
  isUnsupportedRootFilePath,
} from "@/lib/routing/bypass";
import { resolvePublicDocumentRoute } from "@/lib/routing/public/document";
import { readPublicUrlMigrationRedirect } from "@/lib/routing/public/migration";

const handleLocalizedRequest = createMiddleware(routing);
const handlePreviewLocalizedRequest = createMiddleware(previewRouting);
const TRAILING_SLASH_PATTERN = /\/+$/;
const NEXT_INTL_LOCALE_HEADER = "x-next-intl-locale";
const CONTENT_NOT_FOUND_SEGMENT = "_not-found";

/**
 * Adapts Next/Vercel proxy requests to Nakafa route decisions.
 *
 * The proxy keeps platform concerns here: PostHog bypasses, canonical slash
 * redirects, public discovery bypasses, locale middleware, and response
 * rewrites. The llms route seam handles Markdown negotiation, while the route
 * handler owns content lookup and final response status.
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

  if (isUnsupportedRootFilePath(pathname)) {
    return new Response("Not Found\n", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex",
      },
    });
  }

  const previewConfigured = hasPreviewConfig();
  if (
    previewConfigured &&
    (await Effect.runPromise(
      matchesInternalPreviewRoute({
        localeHint: request.headers.get(NEXT_INTL_LOCALE_HEADER),
        pathname,
      })
    ))
  ) {
    return NextResponse.next();
  }

  const candidateLocale = readCandidateLocale(pathname);
  if (candidateLocale) {
    const previewOwnsPathname =
      previewConfigured &&
      (await Effect.runPromise(matchesPreviewPathname(pathname)));
    if (!previewOwnsPathname) {
      return rewriteToContentNotFound(request, candidateLocale);
    }
  }

  if (isOgRouteAliasPathname(pathname)) {
    return NextResponse.next();
  }

  const schoolAuthRedirect = readSchoolAuthRedirect(request);

  if (schoolAuthRedirect) {
    return NextResponse.redirect(schoolAuthRedirect);
  }

  const { markdownExtension: migrationSuffix, pathname: migrationPathname } =
    readLlmsMarkdownPathname(pathname);
  const urlMigrationRedirect = await Effect.runPromise(
    readPublicUrlMigrationRedirect({
      method: request.method,
      pathname: migrationPathname,
    })
  );
  if (urlMigrationRedirect) {
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = `${urlMigrationRedirect}${migrationSuffix}`;

    const response = NextResponse.redirect(redirectUrl, 308);
    mergeRepresentationVary(response);
    return response;
  }

  const routeDecision = await Effect.runPromise(
    resolvePublicDocumentRoute({
      acceptHeader: Option.fromNullOr(request.headers.get("accept")),
      hasAttemptCapability: hasTryoutAttemptCapability(
        request.nextUrl.searchParams
      ),
      method: request.method,
      pathname,
    })
  );

  if (routeDecision.kind === "not-found") {
    return rewriteToContentNotFound(request, routeDecision.locale);
  }

  if (routeDecision.kind === "rewrite-markdown") {
    return rewriteToLlmsMdx(request, routeDecision.localizedRoute);
  }

  if (routeDecision.kind === "not-acceptable") {
    return representationNotAcceptable();
  }

  return routeLocalizedRequest(request, candidateLocale !== null);
}

/** Reads a supported locale that is not in the active public route set. */
function readCandidateLocale(pathname: string): AppLocaleCode | null {
  const [locale] = pathname.split("/").filter(Boolean);
  if (
    !hasLocale(APP_LOCALE_CODES, locale) ||
    hasLocale(routing.locales, locale)
  ) {
    return null;
  }

  return locale;
}

/**
 * Performs the official optimistic cookie check before protected School routes.
 * Convex functions and server data seams still own authoritative authorization.
 */
function readSchoolAuthRedirect(request: NextRequest) {
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
  const redirectPath = hasLocalePrefix
    ? request.nextUrl.pathname
    : `/${locale}${request.nextUrl.pathname}`;
  const redirectUrl = new URL(`/${locale}/auth`, request.url);
  redirectUrl.searchParams.set("redirect", redirectPath);

  return redirectUrl;
}

/** Applies next-intl routing and Nakafa discovery headers once per pass. */
function routeLocalizedRequest(
  request: NextRequest,
  usesCandidateLocale: boolean
) {
  const response = usesCandidateLocale
    ? handlePreviewLocalizedRequest(request)
    : handleLocalizedRequest(request);
  response.headers.append("Link", AGENT_DISCOVERY_LINK_HEADER);
  response.headers.set("X-Llms-Txt", LLMS_TEXT_PATH);
  mergeRepresentationVary(response);

  return response;
}

/** Rewrites a localized route to the source-backed markdown handler. */
function rewriteToLlmsMdx(
  request: NextRequest,
  localizedRoute: LocalizedLlmsRoute
) {
  const rewriteUrl = new URL(request.url);
  rewriteUrl.pathname = `/llms.mdx/${localizedRoute.locale}${localizedRoute.route}`;

  const response = NextResponse.rewrite(rewriteUrl);
  mergeRepresentationVary(response);
  return response;
}

/** Returns a hard 406 when neither public page representation is acceptable. */
function representationNotAcceptable() {
  return new Response("Not Acceptable\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      Vary: LLMS_REPRESENTATION_VARY_FIELDS.join(", "),
    },
    status: 406,
  });
}

/** Preserves framework Vary fields and adds representation cache keys. */
function mergeRepresentationVary(response: Response) {
  response.headers.set(
    "Vary",
    mergeVaryHeader(
      Option.fromNullOr(response.headers.get("Vary")),
      LLMS_REPRESENTATION_VARY_FIELDS
    )
  );
}

/** Rewrites missing content to the styled app not-found route with 404 status. */
function rewriteToContentNotFound(request: NextRequest, locale: AppLocaleCode) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NEXT_INTL_LOCALE_HEADER, locale);
  const rewriteUrl = new URL(
    `/${CONTENT_NOT_FOUND_SEGMENT}/${locale}`,
    request.url
  );

  const response = NextResponse.rewrite(rewriteUrl, {
    headers: {
      "X-Robots-Tag": "noindex",
    },
    request: {
      headers: requestHeaders,
    },
    status: 404,
  });
  mergeRepresentationVary(response);
  return response;
}

export const config: ProxyConfig = {
  matcher: [
    "/((?!_next/static|_not-found|fonts|open-graph|api|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|gltf|bin|ktx2|hdr|exr|js|css|xml|webmanifest|txt)$).*)",
    "/:rootFile([^/]+\\.(?:svg|jpg|jpeg|gif|webp|glb|gltf|bin|ktx2|hdr|exr|js|css|xml|webmanifest|txt))",
  ],
};
