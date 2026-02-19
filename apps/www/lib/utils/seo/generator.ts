import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { createSEODescription } from "./descriptions";
import { createSEOTitle } from "./titles";
import type { ContentSEOData, SEOContext, SEOMetadata } from "./types";

/**
 * Gets effective title with fallback chain:
 * 1. data.title
 * 2. data.subject
 * 3. data.displayName (pre-translated from page)
 * 4. Metadata.title (ultimate fallback)
 */
async function getEffectiveTitle(
  data: ContentSEOData,
  locale: Locale
): Promise<string> {
  if (data.title?.trim()) {
    return data.title.trim();
  }

  if (data.subject?.trim()) {
    return data.subject.trim();
  }

  if (data.displayName?.trim()) {
    return data.displayName.trim();
  }

  const tMeta = await getTranslations({ locale, namespace: "Metadata" });
  return tMeta("title");
}

/**
 * Generates SEO metadata using ICU templates with graceful fallbacks.
 * All translations come from i18n - no hardcoded strings.
 */
export async function generateSEOMetadata(
  context: SEOContext,
  locale: Locale
): Promise<SEOMetadata> {
  const { type } = context;
  const t = await getTranslations({ locale, namespace: "SEO" });

  try {
    switch (type) {
      case "subject": {
        const { data, grade, material } = context;
        const subject = data.subject || material;
        const effectiveTitle = await getEffectiveTitle(data, locale);

        return {
          title: t("subject.title", { title: effectiveTitle, subject, grade }),
          description: t("subject.description", {
            title: effectiveTitle,
            subject,
            grade,
          }),
          keywords: t("subject.keywords", {
            title: effectiveTitle,
            subject,
            grade,
          })
            .split(", ")
            .map((k) => k.trim()),
        };
      }

      case "exercise": {
        const { data, material, setNumber, questionCount } = context;
        const effectiveTitle = await getEffectiveTitle(data, locale);

        return {
          title: t("exercise.title", {
            setNumber: setNumber ?? 1,
            material,
            title: effectiveTitle,
          }),
          description: t("exercise.description", {
            material,
            questionCount: questionCount ?? 20,
            title: effectiveTitle,
          }),
          keywords: t("exercise.keywords", { material, title: effectiveTitle })
            .split(", ")
            .map((k) => k.trim()),
        };
      }

      case "article": {
        const { data, category } = context;
        const effectiveTitle = await getEffectiveTitle(data, locale);

        return {
          title: t("article.title", { title: effectiveTitle, category }),
          description: t("article.description", {
            title: effectiveTitle,
            category,
          }),
          keywords: t("article.keywords", { title: effectiveTitle, category })
            .split(", ")
            .map((k) => k.trim()),
        };
      }

      case "quran": {
        const { surah } = context;
        const name = surah.name.short;
        const transliteration =
          surah.name.transliteration[locale] ||
          surah.name.transliteration.en ||
          name;
        const translation =
          surah.name.translation[locale] || surah.name.translation.en || name;
        const revelation =
          surah.revelation[locale] || surah.revelation.en || "";
        const effectiveTitle = translation || name;

        return {
          title: t("quran.title", {
            number: surah.number,
            name,
            transliteration,
            translation: effectiveTitle,
          }),
          description: t("quran.description", {
            name,
            transliteration,
            numberOfVerses: surah.numberOfVerses,
          }),
          keywords: t("quran.keywords", {
            name,
            translation: effectiveTitle,
            revelation,
          })
            .split(", ")
            .map((k) => k.trim()),
        };
      }

      default: {
        const _exhaustiveCheck: never = type;
        throw new Error(`Unhandled SEO context type: ${_exhaustiveCheck}`);
      }
    }
  } catch (error) {
    console.warn("SEO template failed, using fallback:", error);
    return generateFallbackMetadata(context);
  }
}

/**
 * Fallback using legacy functions when ICU templates fail.
 */
function generateFallbackMetadata(context: SEOContext): SEOMetadata {
  const data =
    "data" in context
      ? context.data
      : { title: "", description: "", subject: "" };

  return {
    title: createSEOTitle([data?.title, data?.subject]),
    description: createSEODescription([data?.description, data?.title]),
    keywords: [],
  };
}
