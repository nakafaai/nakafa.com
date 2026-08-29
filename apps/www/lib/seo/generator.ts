import { getGradeNonNumeric } from "@repo/contents/_lib/curriculum/grade";
import type {
  Grade,
  PresentedMaterialDomain,
} from "@repo/contents/_types/taxonomy";
import { Effect, Option } from "effect";
import type { Locale } from "next-intl";
import type {
  ContentSEOData,
  SEOContext,
  SEOMetadata,
} from "@/lib/seo/contract";
import { generateFallbackMetadata } from "@/lib/seo/fallback";
import { createSEOKeywords } from "@/lib/seo/keywords";
import { generateQuranMetadata } from "@/lib/seo/quran";
import { fetchSEOTranslationsNamespace } from "@/lib/seo/translations";

const EMPTY_SELECT_VALUE = "__EMPTY__";

/** Fetches translations for the Metadata namespace. */
const fetchMetadataTranslations = (locale: Locale) =>
  fetchSEOTranslationsNamespace(locale, "Metadata");

/** Fetches translations for the Subject namespace. */
const fetchSubjectTranslations = (locale: Locale) =>
  fetchSEOTranslationsNamespace(locale, "Subject");

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
  (material: PresentedMaterialDomain, locale: Locale) =>
    Effect.gen(function* () {
      const tSubject = yield* fetchSubjectTranslations(locale);
      return tSubject(material);
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

/** Converts optional metadata fields into the non-empty token ICU select expects. */
function readOptionalSelectValue(value: string | undefined) {
  return value?.trim() || EMPTY_SELECT_VALUE;
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

      const chapterValue = readOptionalSelectValue(chapter);

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
        keywords: createSEOKeywords(
          t("subject.keywords", {
            title: effectiveTitle,
            chapter: chapterValue,
            material: materialDisplayName,
            grade: gradeDisplay,
          })
        ),
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
      const parentValue = readOptionalSelectValue(parent);
      const programValue = readOptionalSelectValue(program);

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
        keywords: createSEOKeywords(
          t("curriculum.keywords", {
            title: effectiveTitle,
            parent: parentValue,
            program: programValue,
          })
        ),
      };
    })
);

/**
 * Generates SEO metadata for article content.
 */
const generateArticleMetadata = Effect.fn("SEO.generateArticleMetadata")(
  (context: Extract<SEOContext, { type: "article" }>, locale: Locale) =>
    Effect.gen(function* () {
      const { data, categoryLabel } = context;

      const [t, effectiveTitle] = yield* Effect.all([
        fetchSEOTranslations(locale),
        getEffectiveTitle(data, locale),
      ]);

      return {
        title: t("article.title", {
          title: effectiveTitle,
          category: categoryLabel,
        }),
        description:
          getContentDescription(data) ??
          t("article.description", {
            title: effectiveTitle,
            category: categoryLabel,
          }),
        keywords: createSEOKeywords(
          t("article.keywords", {
            title: effectiveTitle,
            category: categoryLabel,
          })
        ),
      };
    })
);

/** Generates one complete SEO projection through typed translation failures. */
export const generateSEOMetadata = Effect.fn("SEO.generateMetadata")(
  (context: SEOContext, locale: Locale): Effect.Effect<SEOMetadata> => {
    const { type } = context;

    return Effect.gen(function* () {
      if (type === "material-lesson") {
        return yield* generateSubjectMetadata(context, locale);
      }

      if (type === "curriculum-context") {
        return yield* generateCurriculumMetadata(context, locale);
      }

      if (type === "article") {
        return yield* generateArticleMetadata(context, locale);
      }

      return yield* generateQuranMetadata(context.surah, locale);
    }).pipe(
      Effect.catchTag("SEOTranslationLoadError", () =>
        Effect.sync(() => generateFallbackMetadata(context))
      )
    );
  }
);
