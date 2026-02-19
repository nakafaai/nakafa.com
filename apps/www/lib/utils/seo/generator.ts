import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { createSEODescription } from "./descriptions";
import { createSEOTitle } from "./titles";
import type { ContentSEOData, SEOContext, SEOMetadata } from "./types";

/**
 * Gets effective title with fallback chain
 * Priority: data.title > data.subject > context-specific > Metadata.title
 * Evidence: Google penalizes generic/empty titles
 * Source: https://developers.google.com/search/docs/appearance/title-link
 */
async function getEffectiveTitle(
  data: ContentSEOData,
  context: SEOContext,
  locale: Locale
): Promise<string> {
  // Priority 1: Content title (trimmed)
  if (data.title?.trim()) {
    return data.title.trim();
  }

  // Priority 2: Subject name
  if (data.subject?.trim()) {
    return data.subject.trim();
  }

  // Priority 3: Context-specific fallback
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  let contextFallback: string | undefined;

  switch (context.type) {
    case "subject":
      contextFallback = tCommon(
        context.material as unknown as Parameters<typeof tCommon>[0]
      );
      break;
    case "exercise":
      contextFallback = tCommon(
        context.material as unknown as Parameters<typeof tCommon>[0]
      );
      break;
    case "article":
      contextFallback = tCommon(
        context.category as unknown as Parameters<typeof tCommon>[0]
      );
      break;
    case "quran":
      contextFallback = context.surah.name.translation.en;
      break;
    default:
      // TypeScript ensures all cases are handled via discriminated union
      // This default satisfies linter while being unreachable
      break;
  }

  if (contextFallback) {
    return contextFallback;
  }

  // Priority 4: i18n Metadata.title (brand fallback)
  // Evidence: Always have meaningful title, never empty/undefined
  const tMeta = await getTranslations({ locale, namespace: "Metadata" });
  return tMeta("title");
}

/**
 * Generates SEO metadata using ICU message templates with graceful fallbacks
 * Evidence: ICU is the industry standard for internationalization
 * Used by: Google Chrome, Android, iOS, Next-intl
 * Source: https://unicode-org.github.io/icu/userguide/format_parse/messages/
 *
 * Falls back to legacy functions if templates fail (resilient design)
 *
 * @param context - Type-safe SEO context with strict typing
 * @param locale - Current locale for translations
 * @returns Generated SEO metadata (title, description, keywords)
 */
export async function generateSEOMetadata(
  context: SEOContext,
  locale: Locale
): Promise<SEOMetadata> {
  const { type } = context;

  // Evidence: next-intl uses ICU message format
  // Source: https://next-intl-docs.vercel.app/docs/usage/messages#icu-messages
  const t = await getTranslations({ locale, namespace: "SEO" });

  try {
    switch (type) {
      case "subject": {
        const { data, grade, material } = context;
        const subject = data.subject || material;

        // Get effective title with fallbacks
        const effectiveTitle = await getEffectiveTitle(data, context, locale);

        return {
          title: t("subject.title", {
            title: effectiveTitle,
            subject,
            grade,
          }),
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
        const { data, material, setNumber = 1, questionCount = 20 } = context;

        const effectiveTitle = await getEffectiveTitle(data, context, locale);

        return {
          // Evidence: ICU pluralization handles all languages
          // Example: =1 {1 question} other {{questionCount} questions}
          title: t("exercise.title", {
            setNumber,
            material,
            title: effectiveTitle,
          }),
          description: t("exercise.description", {
            material,
            questionCount,
            title: effectiveTitle,
          }),
          keywords: t("exercise.keywords", {
            material,
            title: effectiveTitle,
          })
            .split(", ")
            .map((k) => k.trim()),
        };
      }

      case "article": {
        const { data, category } = context;

        const effectiveTitle = await getEffectiveTitle(data, context, locale);

        return {
          title: t("article.title", {
            title: effectiveTitle,
            category,
          }),
          description: t("article.description", {
            title: effectiveTitle,
            category,
          }),
          keywords: t("article.keywords", {
            title: effectiveTitle,
            category,
          })
            .split(", ")
            .map((k) => k.trim()),
        };
      }

      case "quran": {
        const { surah } = context;

        // Evidence: Arabic name is universal, locale-specific for transliteration/translation
        // Fallback chain: locale -> English -> Arabic
        const name = surah.name.short;
        const transliteration =
          surah.name.transliteration[locale] ||
          surah.name.transliteration.en ||
          name;
        const translation =
          surah.name.translation[locale] || surah.name.translation.en || name;
        const revelation =
          surah.revelation[locale] || surah.revelation.en || "";

        // For Quran, always use surah name as effective title
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
        // Exhaustive check - should never reach here due to TypeScript discriminated union
        // This satisfies linter requirements for switch statement completeness
        const _exhaustiveCheck: never = type;
        throw new Error(`Unhandled SEO context type: ${_exhaustiveCheck}`);
      }
    }
  } catch (error) {
    // Evidence: Fallback ensures site works even if i18n fails
    // Critical for production resilience
    console.warn("SEO template failed, using fallback:", error);
    return generateFallbackMetadata(context);
  }
}

/**
 * Fallback metadata generator using legacy functions
 * Evidence: Title tags critical for SEO
 * Source: https://developers.google.com/search/docs/appearance/title-link
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
