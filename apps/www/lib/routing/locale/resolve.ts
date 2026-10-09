import { routing } from "@repo/internationalization/src/routing";
import { Array as Arr, Data, Effect, Schema } from "effect";
import { hasLocale } from "next-intl";
import { readPublishedLocalizedHref } from "@/lib/routing/locale/published";
import { projectLocalizedMappedRoutePathname } from "@/lib/routing/public/pathnames";

/** Locale values accepted by next-intl routing and public route projection. */
const LocaleSchema = Schema.Literals(routing.locales);

/** Browser route-localization request accepted by the resolver. */
const LocalizedHrefInputSchema = Schema.Struct({
  href: Schema.String,
  locale: LocaleSchema,
});
type LocalizedHrefInput = typeof LocalizedHrefInputSchema.Type;

/** Normalized browser href after stripping one optional leading locale segment. */
const ParsedLocalizedHrefSchema = Schema.Struct({
  currentLocale: Schema.UndefinedOr(LocaleSchema),
  hash: Schema.String,
  publicPath: Schema.String,
  search: Schema.String,
});
type ParsedLocalizedHref = typeof ParsedLocalizedHrefSchema.Type;

/** Raised when the browser href cannot be parsed as a safe URL. */
class InvalidLocalizedHrefError extends Data.TaggedError(
  "InvalidLocalizedHrefError"
)<{
  cause: unknown;
  href: string;
}> {}

const URL_BASE = "https://nakafa.com";

/** Narrows the leading path segment to a configured locale, if present. */
function readLocale(value: string | undefined) {
  if (value && hasLocale(routing.locales, value)) {
    return value;
  }
}

/**
 * Parses absolute or relative browser hrefs against Nakafa's origin while
 * preserving query/hash state for the final localized navigation.
 */
function parseLocalizedHref(href: string): ParsedLocalizedHref {
  const url = new URL(href, URL_BASE);
  const segments = Arr.filter(url.pathname.split("/"), Boolean);
  const currentLocale = readLocale(segments[0]);
  const publicSegments = currentLocale ? segments.slice(1) : segments;

  return {
    currentLocale,
    hash: url.hash,
    publicPath: Arr.join(publicSegments, "/"),
    search: url.search,
  };
}

/**
 * Returns a next-intl navigation href without a locale prefix; the router adds
 * the target locale using its configured localized pathname mapping.
 */
function toNavigationHref(publicPath: string, suffix: string) {
  return `/${publicPath}${suffix}`;
}

/** Preserves static page query/hash state when no source projection is needed. */
function toStaticNavigationHref(parsed: ParsedLocalizedHref) {
  return toNavigationHref(parsed.publicPath, `${parsed.search}${parsed.hash}`);
}

/**
 * Resolves a browser href to the target locale's route-owned navigation href.
 *
 * Projected content routes are matched by stable source identity. Static app
 * routes keep the regular next-intl locale switch behavior and preserve
 * query/hash state.
 */
export const resolveLocalizedNavigationHref = Effect.fn(
  "www.routing.locale.resolve"
)(function* (input: LocalizedHrefInput) {
  const parsed = yield* Effect.try({
    catch: (cause) =>
      new InvalidLocalizedHrefError({ cause, href: input.href }),
    try: () => parseLocalizedHref(input.href),
  });

  if (!parsed.currentLocale || parsed.currentLocale === input.locale) {
    return toStaticNavigationHref(parsed);
  }

  if (parsed.publicPath === "") {
    return toStaticNavigationHref(parsed);
  }

  const mappedPathname = projectLocalizedMappedRoutePathname({
    currentLocale: parsed.currentLocale,
    publicPath: parsed.publicPath,
    targetLocale: input.locale,
  });

  if (mappedPathname) {
    return toNavigationHref(
      mappedPathname.slice(1),
      `${parsed.search}${parsed.hash}`
    );
  }

  const publishedHref = yield* readPublishedLocalizedHref({
    currentLocale: parsed.currentLocale,
    hash: parsed.hash,
    locale: input.locale,
    publicPath: parsed.publicPath,
    search: parsed.search,
  });
  if (publishedHref) {
    return publishedHref;
  }

  return toStaticNavigationHref(parsed);
});
