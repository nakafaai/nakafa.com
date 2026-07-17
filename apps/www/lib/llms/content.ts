import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { getRuntimePublicRoute } from "@/lib/content/runtime/routes";
import { getCachedLlmsSectionIndexText } from "@/lib/llms/indexes";
import { getLlmsLegalPageText } from "@/lib/llms/legal";
import { getCachedLlmsMdxText } from "@/lib/llms/mdx";
import { getQuranLlmsText } from "@/lib/llms/quran";

const PROJECTED_PUBLIC_ROUTE_SEGMENTS: ReadonlySet<string> = new Set(
  PUBLIC_ROUTE_SURFACES.flatMap((surface) => Object.values(surface.routeSlugs))
);

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

    const mdxText = yield* Effect.tryPromise({
      try: () =>
        getCachedLlmsMdxText({
          cleanSlug: source.cleanSlug,
          locale,
          publicSlug: source.publicSlug,
        }),
      catch: (error) => error,
    });
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
      catch: (error) => error,
    });
  }
);

/** Resolves projected public content paths to the internal markdown source path. */
const getLlmsMarkdownSource = Effect.fn("www.llms.markdown.sourcePath")(
  function* ({ cleanSlug, locale }: { cleanSlug: string; locale: Locale }) {
    if (!isProjectedPublicMarkdownRoute(cleanSlug)) {
      return { cleanSlug };
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

    return {
      cleanSlug: publicRoute.sourcePath,
      publicSlug: cleanSlug,
    };
  }
);

/** Limits public-to-source projection lookups to projected route namespaces. */
function isProjectedPublicMarkdownRoute(cleanSlug: string) {
  const [segment] = cleanSlug.split("/").filter(Boolean);

  return PROJECTED_PUBLIC_ROUTE_SEGMENTS.has(segment ?? "");
}
