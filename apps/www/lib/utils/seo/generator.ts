import { getGradeNonNumeric } from "@repo/contents/_lib/subject/grade";
import type { Grade } from "@repo/contents/_types/subject/grade";
import { Effect } from "effect";
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
const getEffectiveTitle = Effect.fn("SEO.getEffectiveTitle")(
  (data: ContentSEOData, locale: Locale) =>
    Effect.gen(function* () {
      if (data.title?.trim()) {
        return data.title.trim();
      }

      if (data.subject?.trim()) {
        return data.subject.trim();
      }

      if (data.displayName?.trim()) {
        return data.displayName.trim();
      }

      const tMeta = yield* Effect.tryPromise({
        try: () => getTranslations({ locale, namespace: "Metadata" }),
        catch: () => new Error("Failed to load Metadata translations"),
      });

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
      const tSubject = yield* Effect.tryPromise({
        try: () => getTranslations({ locale, namespace: "Subject" }),
        catch: () => new Error("Failed to load Subject translations"),
      });

      const nonNumericGrade = getGradeNonNumeric(grade);

      if (nonNumericGrade) {
        return tSubject(nonNumericGrade);
      }

      return tSubject("grade", { grade });
    })
);

/**
 * Generates SEO metadata for subject content.
 */
const generateSubjectMetadata = Effect.fn("SEO.generateSubjectMetadata")(
  (context: Extract<SEOContext, { type: "subject" }>, locale: Locale) =>
    Effect.gen(function* () {
      const { data, grade, material } = context;
      const subject = data.subject || material;

      const [t, effectiveTitle, gradeDisplay] = yield* Effect.all([
        Effect.tryPromise({
          try: () => getTranslations({ locale, namespace: "SEO" }),
          catch: () => new Error("Failed to load SEO translations"),
        }),
        getEffectiveTitle(data, locale),
        formatGradeForDisplay(grade, locale),
      ]);

      return {
        title: t("subject.title", {
          title: effectiveTitle,
          subject,
          grade: gradeDisplay,
        }),
        description: t("subject.description", {
          title: effectiveTitle,
          subject,
          grade: gradeDisplay,
        }),
        keywords: t("subject.keywords", {
          title: effectiveTitle,
          subject,
          grade: gradeDisplay,
        })
          .split(", ")
          .map((k) => k.trim()),
      };
    })
);

/**
 * Generates SEO metadata for exercise content.
 */
const generateExerciseMetadata = Effect.fn("SEO.generateExerciseMetadata")(
  (context: Extract<SEOContext, { type: "exercise" }>, locale: Locale) =>
    Effect.gen(function* () {
      const { data, material, setNumber, questionCount } = context;

      const [t, effectiveTitle] = yield* Effect.all([
        Effect.tryPromise({
          try: () => getTranslations({ locale, namespace: "SEO" }),
          catch: () => new Error("Failed to load SEO translations"),
        }),
        getEffectiveTitle(data, locale),
      ]);

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
    })
);

/**
 * Generates SEO metadata for article content.
 */
const generateArticleMetadata = Effect.fn("SEO.generateArticleMetadata")(
  (context: Extract<SEOContext, { type: "article" }>, locale: Locale) =>
    Effect.gen(function* () {
      const { data, category } = context;

      const [t, effectiveTitle] = yield* Effect.all([
        Effect.tryPromise({
          try: () => getTranslations({ locale, namespace: "SEO" }),
          catch: () => new Error("Failed to load SEO translations"),
        }),
        getEffectiveTitle(data, locale),
      ]);

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

      const t = yield* Effect.tryPromise({
        try: () => getTranslations({ locale, namespace: "SEO" }),
        catch: () => new Error("Failed to load SEO translations"),
      });

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
