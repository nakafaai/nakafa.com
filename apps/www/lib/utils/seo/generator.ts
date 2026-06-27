import { getGradeNonNumeric } from "@repo/contents/_lib/curriculum/grade";
import type {
  ArticleCategory,
  ExercisesCategory,
  ExercisesMaterial,
  ExercisesType,
  Grade,
  Material,
} from "@repo/contents/_types/taxonomy";
import { Effect, Option } from "effect";
import { cacheLife } from "next/cache";
import type { Locale } from "next-intl";
import { generateFallbackMetadata } from "@/lib/utils/seo/fallback";
import { generateQuranMetadata } from "@/lib/utils/seo/quran";
import { fetchSEOTranslationsNamespace } from "@/lib/utils/seo/translations";
import type {
  ContentSEOData,
  SEOContext,
  SEOMetadata,
} from "@/lib/utils/seo/types";

/** Fetches translations for the Metadata namespace. */
const fetchMetadataTranslations = (locale: Locale) =>
  fetchSEOTranslationsNamespace(locale, "Metadata");

/** Fetches translations for the Subject namespace. */
const fetchSubjectTranslations = (locale: Locale) =>
  fetchSEOTranslationsNamespace(locale, "Subject");

/** Fetches translations for the Exercises namespace. */
const fetchExercisesTranslations = (locale: Locale) =>
  fetchSEOTranslationsNamespace(locale, "Exercises");

/** Fetches translations for the Articles namespace. */
const fetchArticlesTranslations = (locale: Locale) =>
  fetchSEOTranslationsNamespace(locale, "Articles");

/** Fetches translations for the SEO namespace. */
const fetchSEOTranslations = (locale: Locale) =>
  fetchSEOTranslationsNamespace(locale, "SEO");

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

/** Translates exercise category from Exercises namespace. */
const translateExerciseCategory = Effect.fn("SEO.translateExerciseCategory")(
  (category: ExercisesCategory, locale: Locale) =>
    Effect.gen(function* () {
      const tExercises = yield* fetchExercisesTranslations(locale);
      return tExercises(category);
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
 * Generates SEO metadata for material content.
 */
const generateSubjectMetadata = Effect.fn("SEO.generateSubjectMetadata")(
  (context: Extract<SEOContext, { type: "material-lesson" }>, locale: Locale) =>
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

/** Generates SEO metadata for practice assessment roots. */
const generateExerciseProgramMetadata = Effect.fn(
  "SEO.generateExerciseProgramMetadata"
)(
  (
    context: Extract<SEOContext, { type: "exercise-program" }>,
    locale: Locale
  ) =>
    Effect.gen(function* () {
      const { category, data, exam } = context;
      const [t, effectiveTitle, categoryDisplayName, examDisplayName] =
        yield* Effect.all([
          fetchSEOTranslations(locale),
          getEffectiveTitle(data, locale),
          translateExerciseCategory(category, locale),
          translateExerciseType(exam, locale),
        ]);

      return {
        title: t("exercise-program.title", {
          category: categoryDisplayName,
          exam: examDisplayName,
          title: effectiveTitle,
        }),
        description:
          getContentDescription(data) ??
          t("exercise-program.description", {
            category: categoryDisplayName,
            exam: examDisplayName,
            title: effectiveTitle,
          }),
        keywords: t("exercise-program.keywords", {
          category: categoryDisplayName,
          exam: examDisplayName,
          title: effectiveTitle,
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
      const questionTotalValue =
        questionCount && questionCount > 0 ? `/${questionCount}` : "__EMPTY__";

      return {
        title: t("exercise.title", {
          exam: examDisplayName,
          group: groupValue,
          set: setValue,
          number: numberValue,
          questionTotal: questionTotalValue,
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

/** Generates SEO metadata for curriculum context pages. */
const generateCurriculumMetadata = Effect.fn("SEO.generateCurriculumMetadata")(
  (
    context: Extract<SEOContext, { type: "curriculum-context" }>,
    locale: Locale
  ) =>
    Effect.gen(function* () {
      const { data, parent, program } = context;
      const [t, effectiveTitle] = yield* Effect.all([
        fetchSEOTranslations(locale),
        getEffectiveTitle(data, locale),
      ]);
      const parentValue = parent?.trim() || "__EMPTY__";
      const programValue = program?.trim() || "__EMPTY__";

      return {
        title: t("curriculum.title", {
          title: effectiveTitle,
          parent: parentValue,
          program: programValue,
        }),
        description:
          getContentDescription(data) ??
          t("curriculum.description", {
            title: effectiveTitle,
            parent: parentValue,
            program: programValue,
          }),
        keywords: t("curriculum.keywords", {
          title: effectiveTitle,
          parent: parentValue,
          program: programValue,
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
    if (type === "material-lesson") {
      return yield* generateSubjectMetadata(context, locale);
    }

    if (type === "exercise") {
      return yield* generateExerciseMetadata(context, locale);
    }

    if (type === "exercise-program") {
      return yield* generateExerciseProgramMetadata(context, locale);
    }

    if (type === "curriculum-context") {
      return yield* generateCurriculumMetadata(context, locale);
    }

    if (type === "article") {
      return yield* generateArticleMetadata(context, locale);
    }

    return yield* generateQuranMetadata(context.surah, locale);
  });

  return await Effect.runPromise(
    effect.pipe(
      Effect.catchTag("SEOTranslationLoadError", () =>
        Effect.sync(() => generateFallbackMetadata(context))
      )
    )
  );
}
