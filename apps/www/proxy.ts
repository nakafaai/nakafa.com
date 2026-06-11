import { isPostHogProxyPathname } from "@repo/analytics/posthog/config";
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
  type LocalizedLlmsRoute,
  resolveLlmsProxyRoute,
} from "@/lib/llms/routes";

const handleLocalizedRequest = createMiddleware(routing);
const TRAILING_SLASH_PATTERN = /\/+$/;
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
 * Adapts Next/Vercel proxy requests to Nakafa route decisions.
 *
 * The proxy keeps platform concerns here: PostHog bypasses, canonical slash
 * redirects, public discovery bypasses, locale middleware, and response
 * rewrites. Markdown support and content existence live behind the llms routes
 * seam so route capability knowledge does not accumulate in this adapter.
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

  const routeDecision = await Effect.runPromise(
    resolveLlmsProxyRoute({
      acceptHeader: request.headers.get("accept"),
      method: request.method,
      pathname,
    })
  );

  if (routeDecision.kind === "rewrite-markdown") {
    return rewriteToLlmsMdx(request, routeDecision.localizedRoute);
  }

  if (routeDecision.kind === "content-not-found") {
    return rewriteToContentNotFound(request, routeDecision.locale);
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

/** Rewrites a localized route to the source-backed markdown handler. */
function rewriteToLlmsMdx(
  request: NextRequest,
  localizedRoute: LocalizedLlmsRoute
) {
  const rewriteUrl = new URL(request.url);
  rewriteUrl.pathname = `/llms.mdx/${localizedRoute.locale}${localizedRoute.route}`;

  return NextResponse.rewrite(rewriteUrl);
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
