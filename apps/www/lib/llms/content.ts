import { findPublicRouteByPath } from "@repo/contents/_types/route/projection";
import type { PublicRoute } from "@repo/contents/_types/route/schema";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import { Effect, Option } from "effect";
import type { Locale } from "next-intl";
import {
  getCachedLlmsExerciseText,
  getLlmsExerciseText,
} from "@/lib/llms/exercises";
import {
  getCachedLlmsSectionIndexText,
  getLlmsSectionIndexText,
} from "@/lib/llms/indexes";
import { getLlmsLegalPageText } from "@/lib/llms/legal";
import { getCachedLlmsMdxText, getLlmsMdxText } from "@/lib/llms/mdx";
import { getQuranLlmsText } from "@/lib/llms/quran";

interface LlmsMarkdownSource {
  cleanSlug: string;
  publicSlug?: string;
}

const PROJECTED_PUBLIC_ROUTE_SEGMENTS: ReadonlySet<string> = new Set(
  PUBLIC_ROUTE_SURFACES.flatMap((surface) => Object.values(surface.routeSlugs))
);

/**
 * Resolves cached markdown for one agent-facing route.
 *
 * The source chain is ordered from concrete page sources to derived indexes:
 * Quran, exercises, MDX content, legal MDX, then sitemap-derived section or
 * listing indexes. A null result means the route has no markdown source.
 */
export const getLlmsMarkdownText = Effect.fn("www.llms.markdown.cached")(
  function* ({ cleanSlug, locale }: { cleanSlug: string; locale: Locale }) {
    const quranText = yield* getQuranLlmsText({ cleanSlug, locale });
    if (quranText) {
      return quranText;
    }

    const source = yield* getLlmsMarkdownSource({ cleanSlug, locale });
    const exerciseText = yield* Effect.tryPromise({
      try: () =>
        getCachedLlmsExerciseText({
          cleanSlug: source.cleanSlug,
          locale,
          publicSlug: source.publicSlug,
        }),
      catch: (error) => error,
    });
    if (exerciseText) {
      return exerciseText;
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

/**
 * Resolves uncached markdown for build-time public artifacts.
 *
 * This mirrors the request-time source chain without using Next cache helpers,
 * so generated llms artifacts and route handlers agree on which routes have
 * source-backed markdown and which routes should remain unsupported.
 */
export const getLlmsSourceMarkdownText = Effect.fn("www.llms.markdown.source")(
  function* ({ cleanSlug, locale }: { cleanSlug: string; locale: Locale }) {
    const quranText = yield* getQuranLlmsText({ cleanSlug, locale });
    if (quranText) {
      return quranText;
    }

    const source = yield* getLlmsMarkdownSource({ cleanSlug, locale });
    const exerciseText = yield* getLlmsExerciseText({
      cleanSlug: source.cleanSlug,
      locale,
      publicSlug: source.publicSlug,
    });
    if (exerciseText) {
      return exerciseText;
    }

    const mdxText = yield* getLlmsMdxText({
      cleanSlug: source.cleanSlug,
      locale,
      publicSlug: source.publicSlug,
    });
    if (mdxText) {
      return mdxText;
    }

    const legalText = yield* getLlmsLegalPageText({ cleanSlug, locale });
    if (legalText) {
      return legalText;
    }

    return yield* getLlmsSectionIndexText(`llms/${locale}/${cleanSlug}`);
  }
);

/** Resolves public material/practice paths to the internal markdown source path. */
const getLlmsMarkdownSource = Effect.fn("www.llms.markdown.sourcePath")(
  function* ({ cleanSlug, locale }: { cleanSlug: string; locale: Locale }) {
    if (!isProjectedPublicMarkdownRoute(cleanSlug)) {
      return { cleanSlug };
    }

    const publicRoute = yield* findPublicRouteByPath(cleanSlug, locale).pipe(
      Effect.catchTag("InvalidPublicRouteSourceError", () =>
        Effect.succeed(Option.none<PublicRoute>())
      )
    );

    return Option.match(publicRoute, {
      onNone: (): LlmsMarkdownSource => ({ cleanSlug }),
      onSome: (route) => getPublicContentMarkdownSource(route, cleanSlug),
    });
  }
);

/** Limits public-to-source projection lookups to projected route namespaces. */
function isProjectedPublicMarkdownRoute(cleanSlug: string) {
  const [segment] = cleanSlug.split("/").filter(Boolean);

  return PROJECTED_PUBLIC_ROUTE_SEGMENTS.has(segment ?? "");
}

/** Keeps public route rows as the only public-to-source markdown seam. */
function getPublicContentMarkdownSource(
  route: PublicRoute,
  cleanSlug: string
): LlmsMarkdownSource {
  if (
    route.kind === "assessment-context" ||
    route.kind === "curriculum-context"
  ) {
    return { cleanSlug };
  }

  return {
    cleanSlug: route.sourcePath,
    publicSlug: cleanSlug,
  };
}
