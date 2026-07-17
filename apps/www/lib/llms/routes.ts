import { routing } from "@repo/internationalization/src/routing";

type SupportedLocale = (typeof routing.locales)[number];

export interface LocalizedLlmsRoute {
  locale: SupportedLocale;
  markdownExtension: string;
  route: string;
}

export interface LlmsProxyRouteRequest {
  acceptHeader: string | null;
  pathname: string;
}

export type LlmsProxyRouteDecision =
  | { kind: "delegate" }
  | { kind: "rewrite-markdown"; localizedRoute: LocalizedLlmsRoute };

const MARKDOWN_EXTENSION_PATTERN = /\.mdx?$/;
const ROOT_PUBLIC_ROUTE = "/";

/**
 * Classifies localized Markdown negotiation before the Next route handler.
 *
 * The proxy only decides whether a request wants Markdown. The rewritten route
 * handler owns content lookup and its final HTTP status, avoiding duplicate
 * catalog reads on every localized request.
 */
export function resolveLlmsProxyRoute(
  request: LlmsProxyRouteRequest
): LlmsProxyRouteDecision {
  const localizedRoute = getLocalizedLlmsRoute(request.pathname);

  if (!localizedRoute) {
    return { kind: "delegate" };
  }

  if (
    !isLlmsMarkdownRequest({
      acceptHeader: request.acceptHeader,
      markdownExtension: localizedRoute.markdownExtension,
    })
  ) {
    return { kind: "delegate" };
  }

  if (localizedRoute.route === ROOT_PUBLIC_ROUTE) {
    return { kind: "delegate" };
  }

  return {
    kind: "rewrite-markdown",
    localizedRoute,
  };
}

/** Parses one locale-prefixed URL and removes its Markdown extension. */
function getLocalizedLlmsRoute(pathname: string): LocalizedLlmsRoute | null {
  const [rawLocale, ...routeSegments] = pathname.split("/").filter(Boolean);
  const locale = getSupportedLocale(rawLocale);

  if (!locale) {
    return null;
  }

  const rawRoute = `/${routeSegments.join("/")}`;
  const markdownExtension =
    rawRoute.match(MARKDOWN_EXTENSION_PATTERN)?.[0] ?? "";

  return {
    locale,
    markdownExtension,
    route: rawRoute.replace(MARKDOWN_EXTENSION_PATTERN, ""),
  };
}

/** Narrows a raw URL segment to the configured locale source of truth. */
function getSupportedLocale(locale: string | undefined) {
  for (const supportedLocale of routing.locales) {
    if (supportedLocale === locale) {
      return supportedLocale;
    }
  }

  return null;
}

/** Detects explicit Markdown suffixes and `Accept: text/markdown`. */
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
