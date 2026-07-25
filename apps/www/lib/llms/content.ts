import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import {
  type ActiveContentReleaseId,
  readActiveContentIdentity,
} from "@/lib/content/published/active";
import { readActiveContentRoute } from "@/lib/content/published/route";
import { getRuntimePublicRoute } from "@/lib/content/runtime/routes";
import { getCachedLlmsSectionIndexText } from "@/lib/llms/indexes";
import { getLlmsLegalPageText } from "@/lib/llms/legal";
import { getCachedLlmsMdxText } from "@/lib/llms/mdx";
import {
  getCachedPublishedText,
  type PublishedMarkdownInput,
} from "@/lib/llms/published";
import { getQuranLlmsText } from "@/lib/llms/quran";

const PROJECTED_PUBLIC_ROUTE_SEGMENTS: ReadonlySet<string> = new Set(
  PUBLIC_ROUTE_SURFACES.flatMap((surface) => Object.values(surface.routeSlugs))
);

const MATERIAL_ROUTE_SEGMENTS: ReadonlySet<string> = new Set(
  PUBLIC_ROUTE_SURFACES.flatMap((surface) =>
    surface.key === "subject" ? Object.values(surface.routeSlugs) : []
  )
);

type MarkdownSource =
  | {
      readonly activeReleaseId: ActiveContentReleaseId;
      readonly family: PublishedMarkdownInput["family"];
      readonly kind: "published";
      readonly publicPath: string;
    }
  | {
      readonly cleanSlug: string;
      readonly kind: "source";
      readonly publicSlug?: string;
    };

/** One rejected Next cache read with its exact content owner preserved. */
class CacheFailure extends Schema.TaggedError<CacheFailure>()("CacheFailure", {
  cause: Schema.Unknown,
  owner: Schema.Literal("index", "published", "source"),
}) {}

/** Reads cached markdown from the one explicit owner selected for a route. */
const readCachedMarkdown = Effect.fn("www.llms.markdown.owner")(function* (
  source: MarkdownSource,
  locale: Locale
) {
  if (source.kind === "published") {
    return yield* Effect.tryPromise({
      catch: (cause) => new CacheFailure({ cause, owner: "published" }),
      try: () => readPublishedMarkdown(source, locale),
    });
  }

  return yield* Effect.tryPromise({
    catch: (cause) => new CacheFailure({ cause, owner: "source" }),
    try: () =>
      getCachedLlmsMdxText({
        cleanSlug: source.cleanSlug,
        locale,
        publicSlug: source.publicSlug,
      }),
  });
});

/**
 * Resolves cached markdown for one agent-facing route.
 *
 * The source chain is ordered from concrete page sources to derived indexes:
 * Quran, MDX content, legal MDX, then sitemap-derived section or listing
 * indexes. A null result means the route has no markdown source.
 */
export const getLlmsMarkdownText = Effect.fn("www.llms.markdown.cached")(
  function* ({ cleanSlug, locale }: { cleanSlug: string; locale: Locale }) {
    const quranText = yield* getQuranLlmsText({ cleanSlug, locale });
    if (quranText) {
      return quranText;
    }

    const source = yield* getLlmsMarkdownSource({ cleanSlug, locale });
    if (!source) {
      return null;
    }

    const mdxText = yield* readCachedMarkdown(source, locale);
    if (mdxText) {
      return mdxText;
    }

    const legalText = yield* getLlmsLegalPageText({ cleanSlug, locale });
    if (legalText) {
      return legalText;
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

/** Resolves projected public content paths to the internal markdown source path. */
const getLlmsMarkdownSource = Effect.fn("www.llms.markdown.sourcePath")(
  function* ({ cleanSlug, locale }: { cleanSlug: string; locale: Locale }) {
    const routeSegment = readRouteSegment(cleanSlug);
    const publishedFamily = readPublishedFamily(routeSegment);
    if (publishedFamily) {
      const active = yield* readActiveContentIdentity();
      const activeRoute = yield* readActiveContentRoute({
        activeReleaseId: active?.releaseId ?? null,
        family: publishedFamily,
        locale,
        publicPath: cleanSlug,
      });
      if (activeRoute.kind === "found") {
        const source: MarkdownSource = {
          activeReleaseId: activeRoute.activeReleaseId,
          family: publishedFamily,
          kind: "published",
          publicPath: cleanSlug,
        };
        return source;
      }
      if (activeRoute.kind === "missing") {
        return null;
      }
    }

    if (!PROJECTED_PUBLIC_ROUTE_SEGMENTS.has(routeSegment)) {
      const source: MarkdownSource = { cleanSlug, kind: "source" };
      return source;
    }

    const publicRoute = yield* getRuntimePublicRoute({
      locale,
      publicPath: cleanSlug,
    });

    if (!publicRoute || publicRoute.kind === "curriculum-context") {
      return null;
    }

    if (!publicRoute.sourcePath) {
      return null;
    }

    const source: MarkdownSource = {
      cleanSlug: publicRoute.sourcePath,
      kind: "source",
      publicSlug: cleanSlug,
    };
    return source;
  }
);

/** Reads the first non-empty route namespace without accepting missing input. */
function readRouteSegment(cleanSlug: string) {
  return cleanSlug.split("/").find(Boolean) ?? "";
}

/** Maps one stable public route namespace to its body-bearing family. */
function readPublishedFamily(
  routeSegment: string
): PublishedMarkdownInput["family"] | null {
  if (routeSegment === "articles") {
    return "article";
  }
  if (MATERIAL_ROUTE_SEGMENTS.has(routeSegment)) {
    return "material";
  }
  return null;
}

/** Reads one family-specific published markdown cache without source fallback. */
function readPublishedMarkdown(
  source: Extract<MarkdownSource, { readonly kind: "published" }>,
  locale: Locale
) {
  const input = {
    activeReleaseId: source.activeReleaseId,
    family: source.family,
    locale,
    publicPath: source.publicPath,
  };
  return getCachedPublishedText(input);
}
