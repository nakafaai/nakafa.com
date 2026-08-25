import { routing } from "@repo/internationalization/src/routing";
import {
  HttpMediaTypeSchema,
  negotiateMediaType,
} from "@repo/utilities/http/accept";
import { Option } from "effect";

type SupportedLocale = (typeof routing.locales)[number];

export interface LocalizedLlmsRoute {
  locale: SupportedLocale;
  markdownExtension: string;
  route: string;
}

export interface LlmsProxyRouteRequest {
  acceptHeader: Option.Option<string>;
  method: string;
  pathname: string;
}

export type LlmsProxyRouteDecision =
  | { kind: "delegate" }
  | { kind: "not-acceptable" }
  | { kind: "rewrite-markdown"; localizedRoute: LocalizedLlmsRoute };

const MARKDOWN_EXTENSION_PATTERN = /\.mdx?$/;
const HTML_MEDIA_TYPE = HttpMediaTypeSchema.make("text/html; charset=utf-8");
export const LLMS_MARKDOWN_MEDIA_TYPE = HttpMediaTypeSchema.make(
  "text/markdown; charset=utf-8"
);
export const LLMS_REPRESENTATION_VARY_FIELDS = Object.freeze([
  "Accept",
  "Accept-Encoding",
]);

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

  if (Option.isNone(localizedRoute)) {
    return { kind: "delegate" };
  }

  if (!isDocumentRequest(request)) {
    return { kind: "delegate" };
  }

  if (localizedRoute.value.markdownExtension) {
    return {
      kind: "rewrite-markdown",
      localizedRoute: localizedRoute.value,
    };
  }

  const negotiatedMediaType = negotiateMediaType(request.acceptHeader, [
    HTML_MEDIA_TYPE,
    LLMS_MARKDOWN_MEDIA_TYPE,
  ]);
  if (Option.isNone(negotiatedMediaType)) {
    return { kind: "not-acceptable" };
  }

  if (negotiatedMediaType.value === HTML_MEDIA_TYPE) {
    return { kind: "delegate" };
  }

  return {
    kind: "rewrite-markdown",
    localizedRoute: localizedRoute.value,
  };
}

/** Keeps Server Actions and React Server Component traffic inside Next.js. */
function isDocumentRequest(request: LlmsProxyRouteRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  return !Option.exists(request.acceptHeader, (acceptHeader) =>
    acceptHeader
      .toLowerCase()
      .split(",")
      .some(
        (mediaRange) =>
          mediaRange.split(";", 1)[0]?.trim() === "text/x-component"
      )
  );
}

/** Parses one locale-prefixed URL and removes its Markdown extension. */
function getLocalizedLlmsRoute(
  pathname: string
): Option.Option<LocalizedLlmsRoute> {
  if (pathname === "/") {
    return Option.some({
      locale: routing.defaultLocale,
      markdownExtension: "",
      route: "",
    });
  }

  const [rawLocale, ...routeSegments] = pathname.split("/").filter(Boolean);
  const locale = getSupportedLocale(rawLocale);

  if (Option.isNone(locale)) {
    return Option.none();
  }

  const rawRoute = `/${routeSegments.join("/")}`;
  const markdownExtension =
    rawRoute.match(MARKDOWN_EXTENSION_PATTERN)?.[0] ?? "";
  const routeWithoutExtension = rawRoute.replace(
    MARKDOWN_EXTENSION_PATTERN,
    ""
  );

  return Option.some({
    locale: locale.value,
    markdownExtension,
    route: routeWithoutExtension === "/" ? "" : routeWithoutExtension,
  });
}

/** Narrows a raw URL segment to the configured locale source of truth. */
function getSupportedLocale(locale: string | undefined) {
  for (const supportedLocale of routing.locales) {
    if (supportedLocale === locale) {
      return Option.some(supportedLocale);
    }
  }

  return Option.none();
}
