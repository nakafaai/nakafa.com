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
export async function getLlmsMarkdownText({
  cleanSlug,
  locale,
}: {
  cleanSlug: string;
  locale: Locale;
}) {
  const quranText = getQuranLlmsText({ cleanSlug, locale });
  if (quranText) {
    return quranText;
  }

  const exerciseText = await getCachedLlmsExerciseText({ cleanSlug, locale });
  if (exerciseText) {
    return exerciseText;
  }

  const mdxText = await getCachedLlmsMdxText({ cleanSlug, locale });
  if (mdxText) {
    return mdxText;
  }

  return await getCachedLlmsSectionIndexText({
    cleanSlug: `llms/${locale}/${cleanSlug}`,
  });
}

/** Resolves uncached markdown for build-time public artifacts. */
export async function getLlmsSourceMarkdownText({
  cleanSlug,
  locale,
}: {
  cleanSlug: string;
  locale: Locale;
}) {
  const quranText = getQuranLlmsText({ cleanSlug, locale });
  if (quranText) {
    return quranText;
  }

  const exerciseText = await getLlmsExerciseText({ cleanSlug, locale });
  if (exerciseText) {
    return exerciseText;
  }

  const mdxText = await getLlmsMdxText({ cleanSlug, locale });
  if (mdxText) {
    return mdxText;
  }

  return await getLlmsSectionIndexText(`llms/${locale}/${cleanSlug}`);
}
