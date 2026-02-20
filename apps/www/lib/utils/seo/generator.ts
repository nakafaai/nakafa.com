import { getGradeNonNumeric } from "@repo/contents/_lib/subject/grade";
import type { ArticleCategory } from "@repo/contents/_types/articles/category";
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { Grade } from "@repo/contents/_types/subject/grade";
import type { Material } from "@repo/contents/_types/subject/material";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { createSEODescription } from "./descriptions";
import { createSEOTitle } from "./titles";
import type { ContentSEOData, SEOContext, SEOMetadata } from "./types";

/**
 * Fetches translations for the Metadata namespace.
 */
const fetchMetadataTranslations = (locale: Locale) =>
  Effect.tryPromise({
    try: () => getTranslations({ locale, namespace: "Metadata" }),
    catch: () => new Error("Failed to load Metadata translations"),
  });

/**
 * Fetches translations for the Subject namespace.
 */
const fetchSubjectTranslations = (locale: Locale) =>
  Effect.tryPromise({
    try: () => getTranslations({ locale, namespace: "Subject" }),
    catch: () => new Error("Failed to load Subject translations"),
  });

/**
 * Fetches translations for the Exercises namespace.
 */
const fetchExercisesTranslations = (locale: Locale) =>
  Effect.tryPromise({
    try: () => getTranslations({ locale, namespace: "Exercises" }),
    catch: () => new Error("Failed to load Exercises translations"),
  });

/**
 * Fetches translations for the Articles namespace.
 */
const fetchArticlesTranslations = (locale: Locale) =>
  Effect.tryPromise({
    try: () => getTranslations({ locale, namespace: "Articles" }),
    catch: () => new Error("Failed to load Articles translations"),
  });

/**
 * Fetches translations for the SEO namespace.
 */
const fetchSEOTranslations = (locale: Locale) =>
  Effect.tryPromise({
    try: () => getTranslations({ locale, namespace: "SEO" }),
    catch: () => new Error("Failed to load SEO translations"),
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
 * Formats grade for display in titles.
 * Reuses getGradeNonNumeric from @repo/contents/_lib/subject/grade.
 * Handles both numeric (1-12) and non-numeric (bachelor, master, phd) grades.
 */
const formatGradeForDisplay = Effect.fn("SEO.formatGradeForDisplay")(
  (grade: Grade, locale: Locale) =>
    Effect.gen(function* () {
      const tSubject = yield* fetchSubjectTranslations(locale);

      const nonNumericGrade = getGradeNonNumeric(grade);

      if (nonNumericGrade) {
        return tSubject(nonNumericGrade);
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
 * Translates category name from Articles namespace.
 */
const translateArticleCategory = Effect.fn("SEO.translateArticleCategory")(
  (category: ArticleCategory, locale: Locale) =>
    Effect.gen(function* () {
      const tArticles = yield* fetchArticlesTranslations(locale);
      return tArticles(category);
    })
);

/**
 * Generates SEO metadata for subject content.
 * Uses ICU select with boolean string keys for conditional rendering.
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
      const chapterValue = chapter?.trim() ?? "__EMPTY__";

      return {
        title: t("subject.title", {
          title: effectiveTitle,
          chapter: chapterValue,
          material: materialDisplayName,
          grade: gradeDisplay,
        }),
        description: t("subject.description", {
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
 * Uses ICU select with boolean string keys for conditional rendering.
 */
const generateExerciseMetadata = Effect.fn("SEO.generateExerciseMetadata")(
  (context: Extract<SEOContext, { type: "exercise" }>, locale: Locale) =>
    Effect.gen(function* () {
      const { data, material, setName, exerciseTypeDisplay, questionCount } =
        context;

      const [t, effectiveTitle, materialDisplayName] = yield* Effect.all([
        fetchSEOTranslations(locale),
        getEffectiveTitle(data, locale),
        translateExerciseMaterial(material, locale),
      ]);

      // Use sentinel value for optional fields in ICU select
      const setNameValue = setName?.trim() ?? "__EMPTY__";

      return {
        title: t("exercise.title", {
          setName: setNameValue,
          exerciseType: exerciseTypeDisplay,
          material: materialDisplayName,
          title: effectiveTitle,
        }),
        description: t("exercise.description", {
          setName: setNameValue,
          exerciseType: exerciseTypeDisplay,
          material: materialDisplayName,
          questionCount: questionCount ?? 0,
          title: effectiveTitle,
        }),
        keywords: t("exercise.keywords", {
          setName: setNameValue,
          exerciseType: exerciseTypeDisplay,
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
        description: t("article.description", {
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
 * Generates SEO metadata using ICU templates with graceful fallbacks.
 * All translations come from i18n - no hardcoded strings.
 * Uses Effect internally for type-safe error handling.
 */
export async function generateSEOMetadata(
  context: SEOContext,
  locale: Locale
): Promise<SEOMetadata> {
  const { type } = context;

  const effect = Effect.gen(function* () {
    switch (type) {
      case "subject": {
        return yield* generateSubjectMetadata(context, locale);
      }
      case "exercise": {
        return yield* generateExerciseMetadata(context, locale);
      }
      case "article": {
        return yield* generateArticleMetadata(context, locale);
      }
      case "quran": {
        return yield* generateQuranMetadata(context, locale);
      }
      default: {
        return generateFallbackMetadata(context);
      }
    }
  });

  return Effect.runPromise(
    effect.pipe(
      Effect.catchAll(() => {
        return Effect.sync(() => generateFallbackMetadata(context));
      })
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
 * Fallback using legacy functions when ICU templates fail.
 */
function generateFallbackMetadata(context: SEOContext): SEOMetadata {
  const data =
    "data" in context
      ? context.data
      : { title: "", description: "", subject: "" };

  const displayName = getDisplayNameFromContext(context);

  return {
    title: createSEOTitle([data?.title, data?.subject, displayName]),
    description: createSEODescription([data?.description, data?.title]),
    keywords: [],
  };
}
