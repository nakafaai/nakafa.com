import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { DEFAULT_LOCALE, LOCALES } from "@repo/internationalization/src/locale";
import {
  HttpMediaTypeSchema,
  negotiateMediaType,
} from "@repo/utilities/http/accept";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { hasLlmsMarkdownSource } from "@/lib/llms/content/markdown";

const LocalizedLlmsRouteSchema = Schema.Struct({
  locale: ActiveAppLocaleCodeSchema,
  markdownExtension: Schema.Literals(["", ".md", ".mdx"]),
  route: Schema.String,
});
type LocalizedLlmsRoute = typeof LocalizedLlmsRouteSchema.Type;

const LlmsProxyRouteRequestSchema = Schema.Struct({
  acceptHeader: Schema.Option(Schema.String),
  method: Schema.String,
  pathname: Schema.String,
});
export type LlmsProxyRouteRequest = typeof LlmsProxyRouteRequestSchema.Type;

const LlmsProxyRouteDecisionSchema = Schema.Union([
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
]);

/**
 * Classifies localized Markdown negotiation before the router.
 *
 * The resolver checks the existing source owner only after Markdown wins.
 * Ordinary HTML stays inside the router without catalog reads, while the
 * Markdown answer owns its final status.
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

/** Reports whether a path addresses a localized document, the only kind that negotiates. */
export function isLocalizedLlmsRoute(pathname: string) {
  return Option.isSome(getLocalizedLlmsRoute(pathname));
}

/** Limits public representation negotiation to safe retrieval methods. */
function isReadMethod(method: string) {
  return method === "GET" || method === "HEAD";
}

/** Removes one explicit Markdown suffix while preserving its exact spelling. */
function readLlmsMarkdownPathname(pathname: string) {
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
      locale: DEFAULT_LOCALE,
      markdownExtension: "",
      route: "",
    });
  }

  const [rawLocale, ...routeSegments] = Arr.filter(
    pathname.split("/"),
    Boolean
  );
  const locale = getSupportedLocale(rawLocale);

  if (Option.isNone(locale)) {
    return Option.none();
  }

  const rawRoute = `/${Arr.join(routeSegments, "/")}`;
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
  for (const supportedLocale of LOCALES) {
    if (supportedLocale === locale) {
      return Option.some(supportedLocale);
    }
  }

  return Option.none();
}
