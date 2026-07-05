import {
  getPublicContentRouteCheck,
  type PublicContentRouteCheck,
} from "@repo/contents/_lib/manifest/public-route";
import { loadStaticPublicLearningIndex } from "@repo/contents/_types/route/learning/static";
import type { PublicRoute } from "@repo/contents/_types/route/schema";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import {
  getRuntimeContentRoute,
  getRuntimeContentRouteParentPage,
} from "@/lib/content/runtime/routes";
import { baseRoutes } from "@/lib/sitemap/routes";

type SupportedLocale = (typeof routing.locales)[number];
type VerifiedContentRouteCheck = Exclude<
  PublicContentRouteCheck,
  { mode: "outside" }
>;
type VerifiedLlmsRouteCheck = VerifiedContentRouteCheck;

export interface LocalizedLlmsRoute {
  locale: SupportedLocale;
  markdownExtension: string;
  route: string;
}

export interface LlmsProxyRouteRequest {
  acceptHeader: string | null;
  method: string;
  pathname: string;
}

export type LlmsProxyRouteDecision =
  | { kind: "content-not-found"; locale: SupportedLocale }
  | { kind: "delegate" }
  | { kind: "rewrite-markdown"; localizedRoute: LocalizedLlmsRoute };

const MARKDOWN_EXTENSION_PATTERN = /\.mdx?$/;
const ROOT_PUBLIC_ROUTE = "/";
const SITEMAP_BASE_ROUTES = new Set(baseRoutes);

/**
 * Classifies one localized HTTP request for the proxy adapter.
 *
 * The resolver hides locale parsing, `.md` suffix handling, sitemap-backed
 * static route discovery, and bounded content route probes. HTML requests
 * always delegate to Next so static projected pages are not coupled to Convex
 * sync state; markdown requests verify the source-backed row before rewriting.
 */
export const resolveLlmsProxyRoute = Effect.fn("www.llms.routes.resolveProxy")(
  function* (request: LlmsProxyRouteRequest) {
    const localizedRoute = getLocalizedLlmsRoute(request.pathname);

    if (!localizedRoute) {
      const decision: LlmsProxyRouteDecision = { kind: "delegate" };
      return decision;
    }

    const wantsMarkdown = isLlmsMarkdownRequest({
      acceptHeader: request.acceptHeader,
      markdownExtension: localizedRoute.markdownExtension,
    });
    const routeCheck = getPublicContentRouteCheck(localizedRoute.route);
    const publicIndex = yield* loadStaticPublicLearningIndex();
    const publicRoute = publicIndex.resolveRouteByPath(
      localizedRoute.route,
      localizedRoute.locale
    );

    let verifiedRouteCheck: VerifiedLlmsRouteCheck;

    if (publicRoute) {
      if (wantsMarkdown && isUnsupportedContextMarkdownRoute(publicRoute)) {
        const decision: LlmsProxyRouteDecision = {
          kind: "content-not-found",
          locale: localizedRoute.locale,
        };
        return decision;
      }

      verifiedRouteCheck = getRouteProjectionCheck(publicRoute);
    } else {
      if (routeCheck.mode === "outside") {
        if (
          wantsMarkdown &&
          localizedRoute.route !== ROOT_PUBLIC_ROUTE &&
          SITEMAP_BASE_ROUTES.has(localizedRoute.route)
        ) {
          const decision: LlmsProxyRouteDecision = {
            kind: "rewrite-markdown",
            localizedRoute,
          };
          return decision;
        }

        const decision: LlmsProxyRouteDecision = { kind: "delegate" };
        return decision;
      }

      verifiedRouteCheck = routeCheck;
    }

    if (wantsMarkdown) {
      if (shouldVerifyContentRoute(request.method)) {
        const exists = yield* contentRouteExists({
          locale: localizedRoute.locale,
          routeCheck: verifiedRouteCheck,
        });

        if (!exists) {
          const decision: LlmsProxyRouteDecision = {
            kind: "content-not-found",
            locale: localizedRoute.locale,
          };
          return decision;
        }
      }

      const decision: LlmsProxyRouteDecision = {
        kind: "rewrite-markdown",
        localizedRoute,
      };
      return decision;
    }

    const decision: LlmsProxyRouteDecision = { kind: "delegate" };
    return decision;
  }
);

/** Checks projected app pages that intentionally have no markdown source. */
function isUnsupportedContextMarkdownRoute(route: PublicRoute) {
  return route.kind === "curriculum-context";
}

/** Converts a projected public route into the existing content lookup contract. */
function getRouteProjectionCheck(route: PublicRoute): VerifiedLlmsRouteCheck {
  if (route.kind === "curriculum-context") {
    return { mode: "app" };
  }

  return {
    mode: "exact",
    route: route.publicPath,
  };
}

/**
 * Parses the locale-prefixed URL path into the route model used by llms.
 *
 * The returned route always starts with `/`, has any markdown extension
 * removed, and carries the stripped extension separately so content negotiation
 * and suffix requests share the same downstream source lookup.
 */
function getLocalizedLlmsRoute(pathname: string): LocalizedLlmsRoute | null {
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

/**
 * Narrows a raw URL segment to the configured locales without widening the type.
 *
 * Returning null keeps unknown locale prefixes in the normal Next/next-intl
 * route flow instead of treating them as llms-capable pages.
 */
function getSupportedLocale(locale: string | undefined) {
  for (const supportedLocale of routing.locales) {
    if (supportedLocale === locale) {
      return supportedLocale;
    }
  }

  return null;
}

/**
 * Detects the two markdown request forms AFDocs checks.
 *
 * `.md` and `.mdx` suffixes are explicit route variants; `Accept:
 * text/markdown` is content negotiation for the HTML URL. Both forms map to
 * the same source-backed markdown resolver.
 */
function isLlmsMarkdownRequest({
  acceptHeader,
  markdownExtension,
}: {
  acceptHeader: string | null;
  markdownExtension: string;
}) {
  return (
    Boolean(markdownExtension) ||
    acceptHeader?.includes("text/markdown") === true
  );
}

/**
 * Limits content existence probes to safe read methods.
 *
 * Non-read methods keep normal application routing so proxy checks do not add
 * side effects or method-specific behavior to content pages.
 */
function shouldVerifyContentRoute(method: string) {
  return method === "GET" || method === "HEAD";
}

/**
 * Verifies that a content route classified by the manifest has backing rows.
 *
 * Exact routes use one indexed route lookup. Listing routes use a single
 * bounded page read scoped by kind, parent, or prefix. App shell routes are
 * treated as present, known invalid taxonomy routes are treated as missing,
 * and catalog failures fail closed so unsupported URLs never become soft 404s.
 */
const contentRouteExists = Effect.fn("www.llms.routes.contentExists")(
  function* ({
    locale,
    routeCheck,
  }: {
    locale: SupportedLocale;
    routeCheck: VerifiedLlmsRouteCheck;
  }) {
    if (routeCheck.mode === "app") {
      return true;
    }

    if (routeCheck.mode === "missing") {
      return false;
    }

    if (routeCheck.mode === "exact") {
      return yield* getRuntimeContentRoute({
        locale,
        route: routeCheck.route,
      }).pipe(
        Effect.match({
          onFailure: () => false,
          onSuccess: (contentRoute) => contentRoute !== null,
        })
      );
    }

    return yield* contentRoutePageHasRows(
      getRuntimeContentRouteParentPage({
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
);

/**
 * Reads one already-scoped route catalog page and converts it to existence.
 *
 * The supplied Effect must already be bounded and indexed by the caller.
 * Failures return false because route existence must be proven by the content
 * runtime model before the proxy exposes markdown for a requested URL.
 */
function contentRoutePageHasRows(
  pageProgram: Effect.Effect<{ page: readonly unknown[] }, unknown>
) {
  return pageProgram.pipe(
    Effect.match({
      onFailure: () => false,
      onSuccess: (page) => page.page.length > 0,
    })
  );
}
