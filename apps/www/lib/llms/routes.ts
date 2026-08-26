import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { routing } from "@repo/internationalization/src/routing";
import {
  HttpMediaTypeSchema,
  negotiateMediaType,
} from "@repo/utilities/http/accept";
import { Effect, Option, Schema } from "effect";
import { hasLlmsMarkdownSource } from "@/lib/llms/content";

export const LocalizedLlmsRouteSchema = Schema.Struct({
  locale: ActiveAppLocaleCodeSchema,
  markdownExtension: Schema.Literals(["", ".md", ".mdx"]),
  route: Schema.String,
});
export type LocalizedLlmsRoute = typeof LocalizedLlmsRouteSchema.Type;

export const LlmsProxyRouteRequestSchema = Schema.Struct({
  acceptHeader: Schema.Option(Schema.String),
  isRscRequest: Schema.Boolean,
  method: Schema.String,
  pathname: Schema.String,
});
export type LlmsProxyRouteRequest = typeof LlmsProxyRouteRequestSchema.Type;

export const LlmsProxyRouteDecisionSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("delegate") }),
  Schema.Struct({ kind: Schema.Literal("not-acceptable") }),
  Schema.Struct({
    kind: Schema.Literal("rewrite-markdown"),
    localizedRoute: LocalizedLlmsRouteSchema,
  }),
]);
export type LlmsProxyRouteDecision = typeof LlmsProxyRouteDecisionSchema.Type;

const HTML_MEDIA_TYPE = HttpMediaTypeSchema.make("text/html; charset=utf-8");
export const LLMS_MARKDOWN_MEDIA_TYPE = HttpMediaTypeSchema.make(
  "text/markdown; charset=utf-8"
);
const DOCUMENT_MEDIA_TYPES = [
  HTML_MEDIA_TYPE,
  LLMS_MARKDOWN_MEDIA_TYPE,
] as const;
const HTML_MEDIA_TYPES = [HTML_MEDIA_TYPE] as const;
export const LLMS_REPRESENTATION_VARY_FIELDS = Object.freeze([
  "Accept",
  "Accept-Encoding",
  "RSC",
]);

/**
 * Classifies localized Markdown negotiation before the Next route handler.
 *
 * The resolver checks the existing source owner only after Markdown wins.
 * Ordinary HTML and marked RSC traffic stays inside Next without catalog
 * reads, while the rewritten route handler owns the final Markdown status.
 */
export const resolveLlmsProxyRoute = Effect.fn("www.llms.proxyRoute.resolve")(
  function* (request: LlmsProxyRouteRequest) {
    const localizedRoute = getLocalizedLlmsRoute(request.pathname);

    if (Option.isNone(localizedRoute)) {
      return { kind: "delegate" } satisfies LlmsProxyRouteDecision;
    }

    if (!isReadMethod(request.method)) {
      return { kind: "delegate" } satisfies LlmsProxyRouteDecision;
    }

    if (localizedRoute.value.markdownExtension) {
      return {
        kind: "rewrite-markdown",
        localizedRoute: localizedRoute.value,
      } satisfies LlmsProxyRouteDecision;
    }

    if (request.isRscRequest) {
      return { kind: "delegate" } satisfies LlmsProxyRouteDecision;
    }

    const negotiatedMediaType = negotiateMediaType(
      request.acceptHeader,
      DOCUMENT_MEDIA_TYPES
    );

    if (Option.isNone(negotiatedMediaType)) {
      return { kind: "not-acceptable" } satisfies LlmsProxyRouteDecision;
    }

    if (negotiatedMediaType.value === HTML_MEDIA_TYPE) {
      return { kind: "delegate" } satisfies LlmsProxyRouteDecision;
    }

    const markdownAvailable = yield* hasLlmsMarkdownSource({
      cleanSlug: localizedRoute.value.route.slice(1),
      locale: localizedRoute.value.locale,
    });
    if (markdownAvailable) {
      return {
        kind: "rewrite-markdown",
        localizedRoute: localizedRoute.value,
      } satisfies LlmsProxyRouteDecision;
    }

    const fallbackMediaType = negotiateMediaType(
      request.acceptHeader,
      HTML_MEDIA_TYPES
    );
    if (Option.isNone(fallbackMediaType)) {
      return { kind: "not-acceptable" } satisfies LlmsProxyRouteDecision;
    }

    return { kind: "delegate" } satisfies LlmsProxyRouteDecision;
  }
);

/** Limits public representation negotiation to safe retrieval methods. */
function isReadMethod(method: string) {
  return method === "GET" || method === "HEAD";
}

/** Removes one explicit Markdown suffix while preserving its exact spelling. */
export function readLlmsMarkdownPathname(pathname: string) {
  const markdownExtension = readLlmsMarkdownExtension(pathname);

  return {
    markdownExtension,
    pathname: markdownExtension
      ? pathname.slice(0, -markdownExtension.length)
      : pathname,
  };
}

/** Reads one supported Markdown suffix without widening its value contract. */
function readLlmsMarkdownExtension(
  pathname: string
): LocalizedLlmsRoute["markdownExtension"] {
  if (pathname.endsWith(".mdx")) {
    return ".mdx";
  }

  if (pathname.endsWith(".md")) {
    return ".md";
  }

  return "";
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
  const { markdownExtension, pathname: routeWithoutExtension } =
    readLlmsMarkdownPathname(rawRoute);

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
