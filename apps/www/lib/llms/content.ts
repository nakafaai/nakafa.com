import { Effect } from "effect";
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

    const exerciseText = yield* Effect.tryPromise({
      try: () => getCachedLlmsExerciseText({ cleanSlug, locale }),
      catch: (error) => error,
    });
    if (exerciseText) {
      return exerciseText;
    }

    const mdxText = yield* Effect.tryPromise({
      try: () => getCachedLlmsMdxText({ cleanSlug, locale }),
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

    const exerciseText = yield* getLlmsExerciseText({ cleanSlug, locale });
    if (exerciseText) {
      return exerciseText;
    }

    const mdxText = yield* getLlmsMdxText({ cleanSlug, locale });
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
