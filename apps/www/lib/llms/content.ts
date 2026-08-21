import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import {
  type ActiveContentReleaseId,
  readActiveContentIdentity,
} from "@/lib/content/published/active";
import { readActiveContentRoute } from "@/lib/content/published/route";
import { getCachedLlmsSectionIndexText } from "@/lib/llms/indexes";
import {
  getCachedPublishedText,
  type PublishedMarkdownInput,
} from "@/lib/llms/published";
import { getQuranLlmsText } from "@/lib/llms/quran";

const MATERIAL_ROUTE_SEGMENTS: ReadonlySet<string> = new Set(
  PUBLIC_ROUTE_SURFACES.flatMap((surface) =>
    surface.key === "subject" ? Object.values(surface.routeSlugs) : []
  )
);
interface PublishedMarkdownSource {
  readonly activeReleaseId: ActiveContentReleaseId;
  readonly family: PublishedMarkdownInput["family"];
  readonly publicPath: string;
}
/** One rejected Next cache read with its exact content owner preserved. */
class CacheFailure extends Schema.TaggedError<CacheFailure>()("CacheFailure", {
  cause: Schema.Unknown,
  owner: Schema.Literals(["index", "published"]),
}) {}
/** Reads cached markdown from the signed owner selected for a route. */
const readCachedMarkdown = Effect.fn("www.llms.markdown.owner")(function* (
  source: PublishedMarkdownSource,
  locale: Locale
) {
  return yield* Effect.tryPromise({
    catch: (cause) => new CacheFailure({ cause, owner: "published" }),
    try: () => readPublishedMarkdown(source, locale),
  });
});
/**
 * Resolves cached markdown for one agent-facing route.
 *
 * The source chain is ordered from concrete page owners to derived indexes:
 * Quran, signed content, then sitemap-derived section or listing indexes. A
 * null result means the route has no markdown source.
 */
export const getLlmsMarkdownText = Effect.fn("www.llms.markdown.cached")(
  function* ({ cleanSlug, locale }: { cleanSlug: string; locale: Locale }) {
    const quranText = yield* getQuranLlmsText({ cleanSlug, locale });
    if (quranText) {
      return quranText;
    }
    const published = yield* getPublishedMarkdownSource({ cleanSlug, locale });
    if (published) {
      const mdxText = yield* readCachedMarkdown(published, locale);
      if (mdxText) {
        return mdxText;
      }
    }
    return yield* Effect.tryPromise({
      try: () =>
        getCachedLlmsSectionIndexText({
          cleanSlug: `llms/${locale}/${cleanSlug}`,
        }),
      catch: (cause) => new CacheFailure({ cause, owner: "index" }),
    });
  }
);
/** Resolves one public route to its active signed markdown owner. */
const getPublishedMarkdownSource = Effect.fn("www.llms.markdown.source")(
  function* ({ cleanSlug, locale }: { cleanSlug: string; locale: Locale }) {
    const appLocale = AppLocaleSchema.make(locale);
    const publishedFamily = readPublishedFamily(cleanSlug);
    if (!publishedFamily) {
      return null;
    }
    const active = yield* readActiveContentIdentity();
    const activeRoute = yield* readActiveContentRoute({
      activeReleaseId: active?.releaseId ?? null,
      appLocale,
      family: publishedFamily,
      publicPath: cleanSlug,
    });
    if (activeRoute.kind !== "found") {
      return null;
    }
    return {
      activeReleaseId: activeRoute.activeReleaseId,
      family: publishedFamily,
      publicPath: cleanSlug,
    };
  }
);
/** Maps one stable public route namespace to its body-bearing family. */
function readPublishedFamily(
  cleanSlug: string
): PublishedMarkdownInput["family"] | null {
  const segments = cleanSlug.split("/").filter(Boolean);
  const [routeSegment] = segments;
  if (routeSegment === "articles") {
    return "article";
  }
  if (routeSegment && MATERIAL_ROUTE_SEGMENTS.has(routeSegment)) {
    return "material";
  }
  if (segments.length > 0) {
    return "page";
  }
  return null;
}
/** Reads one family-specific published markdown cache without source fallback. */
function readPublishedMarkdown(
  source: PublishedMarkdownSource,
  locale: Locale
) {
  const input = {
    activeReleaseId: source.activeReleaseId,
    appLocale: AppLocaleSchema.make(locale),
    family: source.family,
    publicPath: source.publicPath,
  };
  return getCachedPublishedText(input);
}
