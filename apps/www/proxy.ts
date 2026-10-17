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
import { Array as Arr, Effect, Option } from "effect";
import type { ProxyConfig } from "next/server";
import { type NextRequest, NextResponse } from "next/server";
import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import { hasTryoutAttemptCapability } from "@/components/tryout/route/path";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import {
  matchesInternalPreviewRoute,
  matchesPreviewPathname,
} from "@/lib/content/preview/route";
import { AGENT_DISCOVERY_LINK_HEADER, LLMS_TEXT_PATH } from "@/lib/discovery";
import { resolvePublicDocumentRoute } from "@/lib/llms/document";
import {
  LLMS_REPRESENTATION_VARY_FIELDS,
  type LocalizedLlmsRoute,
  readLlmsMarkdownPathname,
} from "@/lib/llms/routes";
import { isOgRouteAliasPathname, readOgRouteAliasLocale } from "@/lib/og/route";
import {
  CONTENT_NOT_FOUND_SEGMENT,
  NEXT_INTL_LOCALE_HEADER,
  plainTextAnswer,
} from "@/lib/routing/answer";
import {
  isLocaleBypassPath,
  isUnsupportedSystemPath,
} from "@/lib/routing/bypass";
import { readPublicUrlMigrationRedirect } from "@/lib/routing/public/migration";
import { readProfileRefusal } from "@/lib/routing/public/profile";
import { readRetiredPublicRoute } from "@/lib/routing/public/retired";
import { routeSchoolPage } from "@/lib/routing/school/refusal";

const handleLocalizedRequest = createMiddleware(routing);
const handlePreviewLocalizedRequest = createMiddleware(previewRouting);
const TRAILING_SLASH_PATTERN = /\/+$/;

/**
 * Adapts Next/Vercel proxy requests to Nakafa route decisions.
 *
 * The proxy keeps platform concerns here: PostHog bypasses, canonical slash
 * redirects, school page refusals and school host rewrites (ADR 0026), public
 * discovery bypasses, locale middleware, and response rewrites. The llms route
 * seam handles Markdown negotiation, while the route handler owns content lookup
 * and final response status.
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

  const slashRedirect = redirectTrailingSlash(request);
  if (slashRedirect) {
    return slashRedirect;
  }

  const schoolResponse = await Effect.runPromise(routeSchoolPage(request));
  if (schoolResponse) {
    return schoolResponse;
  }

  const isRetired = await Effect.runPromise(
    readRetiredPublicRoute({
      hasAttemptCapability: hasTryoutAttemptCapability(
        request.nextUrl.searchParams
      ),
      pathname,
    })
  );
  if (isRetired) {
    return plainTextAnswer(410, "Gone\n");
  }

  if (isLocaleBypassPath(pathname)) {
    return NextResponse.next();
  }

  if (isUnsupportedSystemPath(pathname)) {
    return plainTextAnswer(404, "Not Found\n");
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

  const ogAliasLocale = readOgRouteAliasLocale(pathname);
  if (
    candidateLocale === null &&
    ogAliasLocale !== null &&
    !hasLocale(routing.locales, ogAliasLocale)
  ) {
    return rewriteToContentNotFound(request, routing.defaultLocale);
  }

  if (isOgRouteAliasPathname(pathname)) {
    return NextResponse.next();
  }

  const { markdownExtension: migrationSuffix, pathname: migrationPathname } =
    readLlmsMarkdownPathname(pathname);
  const urlMigrationRedirect = await Effect.runPromise(
    readPublicUrlMigrationRedirect({
      hasAttemptCapability: hasTryoutAttemptCapability(
        request.nextUrl.searchParams
      ),
      headers: request.headers,
      markdown: migrationSuffix !== "",
      method: request.method,
      pathname: migrationPathname,
    })
  );
  if (urlMigrationRedirect) {
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = `${urlMigrationRedirect.destination}${migrationSuffix}`;

    const response = NextResponse.redirect(
      redirectUrl,
      urlMigrationRedirect.status
    );
    mergeRepresentationVary(response);
    return response;
  }

  const profileRefusal = await Effect.runPromise(
    readProfileRefusal(pathname, request.headers)
  );
  if (profileRefusal !== null) {
    return rewriteToContentNotFound(request, profileRefusal);
  }

  const routeDecision = await Effect.runPromise(
    resolvePublicDocumentRoute({
      acceptHeader: Option.fromNullOr(request.headers.get("accept")),
      hasAttemptCapability: hasTryoutAttemptCapability(
        request.nextUrl.searchParams
      ),
      isRscRequest: request.headers.get("rsc") === "1",
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
  const [locale] = Arr.filter(pathname.split("/"), Boolean);
  if (
    !hasLocale(APP_LOCALE_CODES, locale) ||
    hasLocale(routing.locales, locale)
  ) {
    return null;
  }

  return locale;
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

/** Redirects a path with a trailing slash to its one canonical spelling, as a 308. */
function redirectTrailingSlash(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.length <= 1 || !pathname.endsWith("/")) {
    return null;
  }

  const redirectUrl = new URL(request.url);
  redirectUrl.pathname = pathname.replace(TRAILING_SLASH_PATTERN, "");

  return NextResponse.redirect(redirectUrl, 308);
}

/** Returns a hard 406 when neither public page representation is acceptable. */
function representationNotAcceptable() {
  return new Response("Not Acceptable\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      Vary: Arr.join(LLMS_REPRESENTATION_VARY_FIELDS, ", "),
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

/**
 * The requests that reach the proxy. On Vercel the proxy runs before the CDN
 * cache as a Node.js function, so every request it lets in costs one run, a
 * cached page included. A path stays out only when the proxy does nothing for
 * it. The patterns write those paths by hand because a matcher must be a
 * literal, and the proxy test reads the real lists to keep them equal:
 *
 * - The analytics path `/_nakafa` (`POSTHOG_PROXY_PATH`): the proxy passes it
 *   on, and `next.config.ts` rewrites it to PostHog.
 * - Every path in `LOCALE_BYPASS_PATHS`: the icon, the manifest, `/llms.txt`,
 *   `/robots.txt`, `/rss.xml`, the sitemaps, `/skill.md`, the IndexNow key and
 *   the agent skill files. The proxy passes each of them on by name. The first
 *   pattern holds the ones that end in `.md` or `.json`, and the root file
 *   pattern the others. These files are the same on every host, so a school
 *   host and a refused host such as `www` get the file of the main site. Every
 *   path that the matcher leaves out reaches the app on every host, a refused
 *   host included, so a refused host gets the 307 only for the paths that stay
 *   in.
 *
 * What stays in, and what the proxy does with it:
 *
 * - Documents, Flight navigations and prefetches: it may redirect, rewrite,
 *   answer 410 for a removed route, or reject a locale.
 * - Any other root file, such as `/missing.xml`, and any other path under
 *   `/.well-known`: a plain 404, before the path can reach a localized route.
 * - Any other spelling of a bypass path, such as one with a trailing slash,
 *   which it redirects.
 * - The localized image aliases, such as `/en/og/example/image.png`: it passes
 *   a served locale on and rejects an unserved one. The pattern cannot leave
 *   the served locales out, because it would then leave out their upper-case
 *   spellings too wherever the platform matches case-insensitively, and those
 *   must be rejected. So each social image request costs one proxy run, whether
 *   the CDN holds the image or not.
 */
export const config: ProxyConfig = {
  matcher: [
    "/((?!_next/static|_not-found|fonts|open-graph|api|_next/image|favicon.ico|_nakafa(?:/|$)|skill\\.md$|\\.well-known/agent-skills/(?:index\\.json|nakafa/SKILL\\.md)$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|gltf|bin|ktx2|hdr|exr|js|css|xml|webmanifest|txt)$).*)",
    "/:locale([A-Za-z]{2})/:path*.png",
    "/:rootFile((?!logo\\.svg$|manifest\\.webmanifest$|llms\\.txt$|robots\\.txt$|rss\\.xml$|sitemap\\.txt$|sitemap\\.xml$|e22d548f7fd2482a9022e3b84e944901\\.txt$)[^/]+\\.(?:svg|jpg|jpeg|gif|webp|glb|gltf|bin|ktx2|hdr|exr|js|css|xml|webmanifest|txt))",
    // The pattern above skips `/api`, so the removed finance endpoint names itself.
    "/api/chat/finance",
  ],
};
