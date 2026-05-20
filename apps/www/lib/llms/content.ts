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
import { getCachedLlmsMdxText, getLlmsMdxText } from "@/lib/llms/mdx";
import { getQuranLlmsText } from "@/lib/llms/quran";

/** Resolves markdown for one public content route or its sitemap-derived index. */
export const getLlmsMarkdownText = Effect.fn("www.llms.markdown.cached")(
  function* ({ cleanSlug, locale }: { cleanSlug: string; locale: Locale }) {
    const quranText = getQuranLlmsText({ cleanSlug, locale });
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

    return yield* Effect.tryPromise({
      try: () =>
        getCachedLlmsSectionIndexText({
          cleanSlug: `llms/${locale}/${cleanSlug}`,
        }),
      catch: (error) => error,
    });
  }
);

/** Resolves uncached markdown for build-time public artifacts. */
export const getLlmsSourceMarkdownText = Effect.fn("www.llms.markdown.source")(
  function* ({ cleanSlug, locale }: { cleanSlug: string; locale: Locale }) {
    const quranText = getQuranLlmsText({ cleanSlug, locale });
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

    return yield* getLlmsSectionIndexText(`llms/${locale}/${cleanSlug}`);
  }
);
