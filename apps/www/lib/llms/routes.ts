import { routing } from "@repo/internationalization/src/routing";
import { negotiateMediaType } from "@repo/utilities/http/accept";

type SupportedLocale = (typeof routing.locales)[number];

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
  | { kind: "delegate" }
  | { kind: "not-acceptable" }
  | { kind: "rewrite-markdown"; localizedRoute: LocalizedLlmsRoute };

const MARKDOWN_EXTENSION_PATTERN = /\.mdx?$/;
const HTML_MEDIA_TYPE = "text/html";
const MARKDOWN_MEDIA_TYPE = "text/markdown";

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

  if (!isDocumentRequest(request)) {
    return { kind: "delegate" };
  }

  if (localizedRoute.markdownExtension) {
    return {
      kind: "rewrite-markdown",
      localizedRoute,
    };
  }

  const negotiatedMediaType = negotiateMediaType(request.acceptHeader, [
    HTML_MEDIA_TYPE,
    MARKDOWN_MEDIA_TYPE,
  ]);
  if (negotiatedMediaType === null) {
    return { kind: "not-acceptable" };
  }

  if (negotiatedMediaType === HTML_MEDIA_TYPE) {
    return { kind: "delegate" };
  }

  return {
    kind: "rewrite-markdown",
    localizedRoute,
  };
}

/** Keeps Server Actions and React Server Component traffic inside Next.js. */
function isDocumentRequest(request: LlmsProxyRouteRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  return !request.acceptHeader
    ?.toLowerCase()
    .split(",")
    .some(
      (mediaRange) => mediaRange.split(";", 1)[0]?.trim() === "text/x-component"
    );
}

/** Parses one locale-prefixed URL and removes its Markdown extension. */
function getLocalizedLlmsRoute(pathname: string): LocalizedLlmsRoute | null {
  if (pathname === "/") {
    return {
      locale: routing.defaultLocale,
      markdownExtension: "",
      route: "/",
    };
  }

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
