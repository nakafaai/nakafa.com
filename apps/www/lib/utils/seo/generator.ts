import { getGradeNonNumeric } from "@repo/contents/_lib/subject/grade";
import type {
  ArticleCategory,
  ExercisesMaterial,
  ExercisesType,
  Grade,
  Material,
} from "@repo/contents/_types/taxonomy";
import { Effect, Option, Schema } from "effect";
import { cacheLife } from "next/cache";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { createSEODescription } from "@/lib/utils/seo/descriptions";
import { createSEOTitle } from "@/lib/utils/seo/titles";
import type {
  ContentSEOData,
  SEOContext,
  SEOMetadata,
} from "@/lib/utils/seo/types";

/** Expected failure when a localized SEO dictionary cannot be loaded. */
class SEOTranslationLoadError extends Schema.TaggedError<SEOTranslationLoadError>()(
  "SEOTranslationLoadError",
  {
    locale: Schema.String,
    message: Schema.String,
    namespace: Schema.String,
  }
) {}

/** Converts unknown thrown values into readable fallback error messages. */
function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown translation loading error";
}

/**
 * Fetches translations for the Metadata namespace.
 */
const fetchMetadataTranslations = (locale: Locale) =>
  Effect.tryPromise({
    try: () => getTranslations({ locale, namespace: "Metadata" }),
    catch: (error: unknown) =>
      new SEOTranslationLoadError({
        locale,
        namespace: "Metadata",
        message: `Failed to load Metadata translations: ${getErrorMessage(error)}`,
      }),
  });

/**
 * Fetches translations for the Subject namespace.
 */
const fetchSubjectTranslations = (locale: Locale) =>
  Effect.tryPromise({
    try: () => getTranslations({ locale, namespace: "Subject" }),
    catch: (error: unknown) =>
      new SEOTranslationLoadError({
        locale,
        namespace: "Subject",
        message: `Failed to load Subject translations: ${getErrorMessage(error)}`,
      }),
  });

/**
 * Fetches translations for the Exercises namespace.
 */
const fetchExercisesTranslations = (locale: Locale) =>
  Effect.tryPromise({
    try: () => getTranslations({ locale, namespace: "Exercises" }),
    catch: (error: unknown) =>
      new SEOTranslationLoadError({
        locale,
        namespace: "Exercises",
        message: `Failed to load Exercises translations: ${getErrorMessage(error)}`,
      }),
  });

/**
 * Fetches translations for the Articles namespace.
 */
const fetchArticlesTranslations = (locale: Locale) =>
  Effect.tryPromise({
    try: () => getTranslations({ locale, namespace: "Articles" }),
    catch: (error: unknown) =>
      new SEOTranslationLoadError({
        locale,
        namespace: "Articles",
        message: `Failed to load Articles translations: ${getErrorMessage(error)}`,
      }),
  });

/**
 * Fetches translations for the SEO namespace.
 */
const fetchSEOTranslations = (locale: Locale) =>
  Effect.tryPromise({
    try: () => getTranslations({ locale, namespace: "SEO" }),
    catch: (error: unknown) =>
      new SEOTranslationLoadError({
        locale,
        namespace: "SEO",
        message: `Failed to load SEO translations: ${getErrorMessage(error)}`,
      }),
  });

/**
 * Gets effective title with fallback chain:
 * 1. data.title
 * 2. data.subject
 * 3. Metadata.title (ultimate fallback)
 */
const getEffectiveTitle = Effect.fn("SEO.getEffectiveTitle")(
  (data: ContentSEOData, locale: Locale) =>
    Effect.gen(function* () {
      if (data.title?.trim()) {
        return data.title.trim();
      }

      if (data.subject?.trim()) {
        return data.subject.trim();
      }

      const tMeta = yield* fetchMetadataTranslations(locale);

      return tMeta("title");
    })
);

/**
 * Formats grade for display (numeric or non-numeric like bachelor/master).
 */
const formatGradeForDisplay = Effect.fn("SEO.formatGradeForDisplay")(
  (grade: Grade, locale: Locale) =>
    Effect.gen(function* () {
      const tSubject = yield* fetchSubjectTranslations(locale);

      const nonNumericGrade = getGradeNonNumeric(grade);

      if (Option.isSome(nonNumericGrade)) {
        return tSubject(nonNumericGrade.value);
      }

      return tSubject("grade", { grade });
    })
);

/**
 * Translates material name from Subject namespace.
 */
const translateSubjectMaterial = Effect.fn("SEO.translateSubjectMaterial")(
  (material: Material, locale: Locale) =>
    Effect.gen(function* () {
      const tSubject = yield* fetchSubjectTranslations(locale);
      return tSubject(material);
    })
);

/**
 * Translates material name from Exercises namespace.
 */
const translateExerciseMaterial = Effect.fn("SEO.translateExerciseMaterial")(
  (material: ExercisesMaterial, locale: Locale) =>
    Effect.gen(function* () {
      const tExercises = yield* fetchExercisesTranslations(locale);
      return tExercises(material);
    })
);

/**
 * Translates exam type from Exercises namespace.
 */
const translateExerciseType = Effect.fn("SEO.translateExerciseType")(
  (type: ExercisesType, locale: Locale) =>
    Effect.gen(function* () {
      const tExercises = yield* fetchExercisesTranslations(locale);
      return tExercises(type);
    })
);

/**
 * Translates category name from Articles namespace.
 */
const translateArticleCategory = Effect.fn("SEO.translateArticleCategory")(
  (category: ArticleCategory, locale: Locale) =>
    Effect.gen(function* () {
      const tArticles = yield* fetchArticlesTranslations(locale);
      return tArticles(category);
    })
);

/** Returns the hand-written content description when it is present. */
function getContentDescription(data: ContentSEOData) {
  const description = data.description?.trim();

  if (!description) {
    return null;
  }

  return description;
}

/**
 * Generates SEO metadata for subject content.
 */
const generateSubjectMetadata = Effect.fn("SEO.generateSubjectMetadata")(
  (context: Extract<SEOContext, { type: "subject" }>, locale: Locale) =>
    Effect.gen(function* () {
      const { data, grade, material, chapter } = context;

      const [t, effectiveTitle, gradeDisplay, materialDisplayName] =
        yield* Effect.all([
          fetchSEOTranslations(locale),
          getEffectiveTitle(data, locale),
          formatGradeForDisplay(grade, locale),
          translateSubjectMaterial(material, locale),
        ]);

      // Use sentinel value for optional fields in ICU select
      const chapterValue = chapter?.trim() || "__EMPTY__";

      return {
        title: t("subject.title", {
          title: effectiveTitle,
          chapter: chapterValue,
          material: materialDisplayName,
          grade: gradeDisplay,
        }),
        description:
          getContentDescription(data) ??
          t("subject.description", {
            title: effectiveTitle,
            chapter: chapterValue,
            material: materialDisplayName,
            grade: gradeDisplay,
          }),
        keywords: t("subject.keywords", {
          title: effectiveTitle,
          chapter: chapterValue,
          material: materialDisplayName,
          grade: gradeDisplay,
        })
          .split(", ")
          .map((k: string) => k.trim()),
      };
    })
);

/**
 * Generates SEO metadata for exercise content.
 */
const generateExerciseMetadata = Effect.fn("SEO.generateExerciseMetadata")(
  (context: Extract<SEOContext, { type: "exercise" }>, locale: Locale) =>
    Effect.gen(function* () {
      const { data, material, exam, group, set, number, questionCount } =
        context;

      const [t, effectiveTitle, materialDisplayName, examDisplayName] =
        yield* Effect.all([
          fetchSEOTranslations(locale),
          getEffectiveTitle(data, locale),
          translateExerciseMaterial(material, locale),
          translateExerciseType(exam, locale),
        ]);

      // Use sentinel value for optional fields in ICU select
      const groupValue = group?.trim() || "__EMPTY__";
      const setValue = set?.trim() || "__EMPTY__";

      // Convert number to string for ICU select
      const numberValue = number && number > 0 ? String(number) : "0";

      return {
        title: t("exercise.title", {
          exam: examDisplayName,
          group: groupValue,
          set: setValue,
          number: numberValue,
          questionCount: questionCount ?? 0,
          material: materialDisplayName,
          title: effectiveTitle,
        }),
        description: t("exercise.description", {
          exam: examDisplayName,
          group: groupValue,
          set: setValue,
          material: materialDisplayName,
          questionCount: questionCount ?? 0,
          title: effectiveTitle,
        }),
        keywords: t("exercise.keywords", {
          exam: examDisplayName,
          group: groupValue,
          set: setValue,
          material: materialDisplayName,
          title: effectiveTitle,
        })
          .split(", ")
          .map((k: string) => k.trim()),
      };
    })
);

/**
 * Generates SEO metadata for article content.
 */
const generateArticleMetadata = Effect.fn("SEO.generateArticleMetadata")(
  (context: Extract<SEOContext, { type: "article" }>, locale: Locale) =>
    Effect.gen(function* () {
      const { data, category } = context;

      const [t, effectiveTitle, categoryDisplayName] = yield* Effect.all([
        fetchSEOTranslations(locale),
        getEffectiveTitle(data, locale),
        translateArticleCategory(category, locale),
      ]);

      return {
        title: t("article.title", {
          title: effectiveTitle,
          category: categoryDisplayName,
        }),
        description:
          getContentDescription(data) ??
          t("article.description", {
            title: effectiveTitle,
            category: categoryDisplayName,
          }),
        keywords: t("article.keywords", {
          title: effectiveTitle,
          category: categoryDisplayName,
        })
          .split(", ")
          .map((k: string) => k.trim()),
      };
    })
);

/**
 * Generates SEO metadata for quran content.
 */
const generateQuranMetadata = Effect.fn("SEO.generateQuranMetadata")(
  (context: Extract<SEOContext, { type: "quran" }>, locale: Locale) =>
    Effect.gen(function* () {
      const { surah } = context;
      const name = surah.name.short;
      const transliteration =
        surah.name.transliteration[locale] ||
        surah.name.transliteration.en ||
        name;
      const translation =
        surah.name.translation[locale] || surah.name.translation.en || name;
      const revelation = surah.revelation[locale] || surah.revelation.en || "";
      const effectiveTitle = translation || name;

      const t = yield* fetchSEOTranslations(locale);

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
          .map((k: string) => k.trim()),
      };
    })
);

/**
 * Main entry point for generating SEO metadata.
 */
export async function generateSEOMetadata(
  context: SEOContext,
  locale: Locale
): Promise<SEOMetadata> {
  "use cache";

  cacheLife("max");

  const { type } = context;

  const effect = Effect.gen(function* () {
    if (type === "subject") {
      return yield* generateSubjectMetadata(context, locale);
    }

    if (type === "exercise") {
      return yield* generateExerciseMetadata(context, locale);
    }

    if (type === "article") {
      return yield* generateArticleMetadata(context, locale);
    }

    return yield* generateQuranMetadata(context, locale);
  });

  return await Effect.runPromise(
    effect.pipe(
      Effect.catchTag("SEOTranslationLoadError", () =>
        Effect.sync(() => generateFallbackMetadata(context))
      )
    )
  );
}

/**
 * Gets display name from context for fallback metadata.
 */
function getDisplayNameFromContext(context: SEOContext): string {
  if (context.type === "subject") {
    return context.material;
  }
  if (context.type === "exercise") {
    return context.material;
  }
  if (context.type === "article") {
    return context.category;
  }
  return "";
}

/**
 * Fallback using legacy title/description builders.
 */
function generateFallbackMetadata(context: SEOContext): SEOMetadata {
  const displayName = getDisplayNameFromContext(context);

  // Quran type doesn't have data property - handle first
  if (context.type === "quran") {
    return {
      title: createSEOTitle([context.surah.name.translation.en, displayName]),
      description: createSEODescription([context.surah.name.translation.en]),
      keywords: [],
    };
  }

  // Types with data: subject, exercise, article
  const { data } = context;

  return {
    title: createSEOTitle([data.title, data.subject, displayName]),
    description: createSEODescription([data.description, data.title]),
    keywords: [],
  };
}
