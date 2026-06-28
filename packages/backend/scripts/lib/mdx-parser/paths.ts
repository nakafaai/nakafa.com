import { dirname, posix } from "node:path";
import {
  ARTICLE_PATH_REGEX,
  BACKSLASH_REGEX,
  LEADING_SLASH_REGEX,
  MATERIAL_LESSON_PATH_REGEX,
  MDX_EXTENSION_REGEX,
} from "@repo/backend/scripts/lib/mdx-parser/constants";
import type { ExerciseParsedPath } from "@repo/backend/scripts/lib/mdx-parser/types";
import {
  MdxPathValidationError,
  parseExerciseYear,
  validateArticleCategory,
  validateExercisesMaterial,
  validateExercisesType,
  validateLocale,
  validateMaterial,
} from "@repo/backend/scripts/lib/mdx-parser/validators";
import { Effect } from "effect";

const EXERCISE_TYPE_YEAR_REGEX = /^(.+)-(\d{4})$/;
const EXERCISE_QUESTION_PREFIX_REGEX = /^question-/;

/** Builds the canonical database slug for one exercise set path. */
export const buildExerciseSetSlug = ({
  examType,
  material,
  exerciseType,
  setName,
  year,
}: Pick<
  ExerciseParsedPath,
  "examType" | "material" | "exerciseType" | "setName" | "year"
>) => {
  const exerciseTypeSegment =
    year === undefined ? exerciseType : `${exerciseType}-${year}`;
  const pathSegments = [
    "material",
    "practice",
    "assessment",
    examType,
    material,
    exerciseTypeSegment,
  ];

  pathSegments.push(setName);
  return pathSegments.join("/");
};

/** Parses an article MDX path into its sync identifiers. */
export const parseArticlePath = Effect.fn("mdx.parseArticlePath")(function* (
  filePath: string
) {
  const normalized = filePath.replace(BACKSLASH_REGEX, "/");
  const match = normalized.match(ARTICLE_PATH_REGEX);

  if (!match) {
    return yield* Effect.fail(
      new MdxPathValidationError({
        message: `Invalid article path: ${filePath}`,
      })
    );
  }

  const [, rawCategory, articleSlug, rawLocale] = match;
  const category = yield* validateArticleCategory(
    rawCategory.toLowerCase(),
    filePath
  );
  const locale = yield* validateLocale(rawLocale, filePath);

  return {
    type: "article",
    locale,
    category,
    articleSlug,
    slug: `articles/${category}/${articleSlug}`,
  };
});

/** Parses a curriculum lesson MDX path into its sync identifiers. */
export const parseMaterialLessonPath = Effect.fn("mdx.parseMaterialLessonPath")(
  function* (filePath: string) {
    const normalized = filePath.replace(BACKSLASH_REGEX, "/");
    const match = normalized.match(MATERIAL_LESSON_PATH_REGEX);

    if (!match) {
      return yield* Effect.fail(
        new MdxPathValidationError({
          message: `Invalid material lesson path: ${filePath}`,
        })
      );
    }

    const [, rawMaterial, topic, section, rawLocale] = match;
    const material = yield* validateMaterial(rawMaterial, filePath);
    const locale = yield* validateLocale(rawLocale, filePath);

    return {
      type: "material-lesson",
      locale,
      material,
      topic,
      section,
      slug: `material/lesson/${material}/${topic}/${section}`,
    };
  }
);

/** Parses an exercise question or answer MDX path into its sync identifiers. */
export const parseExercisePath = Effect.fn("mdx.parseExercisePath")(function* (
  filePath: string
) {
  const normalized = filePath.replace(BACKSLASH_REGEX, "/");
  const pathSegments = normalized.split("/");
  const materialIndex = pathSegments.lastIndexOf("material");

  if (materialIndex === -1) {
    return yield* Effect.fail(
      new MdxPathValidationError({
        message: `Invalid exercise path: ${filePath}`,
      })
    );
  }

  const relativeSegments = pathSegments.slice(materialIndex);

  if (relativeSegments.length !== 9) {
    return yield* Effect.fail(
      new MdxPathValidationError({
        message: `Invalid exercise path: ${filePath}`,
      })
    );
  }

  const [
    ,
    practiceSegment,
    assessmentSegment,
    rawExamType,
    rawMaterial,
    rawExerciseType,
    setName,
    rawQuestionNumber,
    rawLocaleFile,
  ] = relativeSegments;

  if (practiceSegment !== "practice" || assessmentSegment !== "assessment") {
    return yield* Effect.fail(
      new MdxPathValidationError({
        message: `Invalid exercise path: ${filePath}`,
      })
    );
  }

  if (!(setName && rawQuestionNumber && rawLocaleFile)) {
    return yield* Effect.fail(
      new MdxPathValidationError({
        message: `Invalid exercise path: ${filePath}`,
      })
    );
  }

  const examType = yield* validateExercisesType(rawExamType, filePath);
  const material = yield* validateExercisesMaterial(rawMaterial, filePath);
  const exerciseTypeParts = rawExerciseType.match(EXERCISE_TYPE_YEAR_REGEX);
  const exerciseType = exerciseTypeParts?.[1] ?? rawExerciseType;
  const year =
    exerciseTypeParts?.[2] === undefined
      ? undefined
      : yield* parseExerciseYear(exerciseTypeParts[2], filePath);
  const [questionOrAnswer, rawLocale] = rawLocaleFile
    .replace(MDX_EXTENSION_REGEX, "")
    .split(".");
  const locale = yield* validateLocale(rawLocale ?? "", filePath);
  const numberStr = rawQuestionNumber.replace(
    EXERCISE_QUESTION_PREFIX_REGEX,
    ""
  );
  const number = Number.parseInt(numberStr, 10);
  const category: ExerciseParsedPath["category"] = "high-school";

  if (!Number.isFinite(number)) {
    return yield* Effect.fail(
      new MdxPathValidationError({
        message: `Invalid exercise number "${numberStr}" in ${filePath}.`,
      })
    );
  }

  if (questionOrAnswer !== "question" && questionOrAnswer !== "answer") {
    return yield* Effect.fail(
      new MdxPathValidationError({
        message: `Invalid exercise path: ${filePath}`,
      })
    );
  }

  const setSlug = buildExerciseSetSlug({
    examType,
    material,
    exerciseType,
    setName,
    year,
  });

  return {
    type: "exercise",
    locale,
    category,
    examType,
    material,
    exerciseType,
    setName,
    number,
    slug: `${setSlug}/${number}`,
    isQuestion: questionOrAnswer === "question",
    year,
  };
});

/** Returns the directory that contains one exercise question and answer pair. */
export const getExerciseDir = Effect.fn("mdx.getExerciseDir")(function* (
  filePath: string
) {
  const normalized = filePath.replace(BACKSLASH_REGEX, "/");
  const exerciseDir = posix.dirname(normalized);

  if (exerciseDir === "." || exerciseDir === "/") {
    return yield* Effect.fail(
      new MdxPathValidationError({
        message: `Cannot extract exercise directory from: ${filePath}`,
      })
    );
  }

  return exerciseDir;
});

/** Returns the directory that contains one localized article MDX file. */
export const getArticleDir = (filePath: string) => dirname(filePath);

/** Converts a material href into path segments relative to its base path. */
export const getRelativeExercisePathSegments = Effect.fn(
  "mdx.getRelativeExercisePathSegments"
)(function* (basePath: string, href: string, context: string) {
  const normalizedBasePath = basePath.replace(LEADING_SLASH_REGEX, "");
  const normalizedHref = href.replace(LEADING_SLASH_REGEX, "");

  if (
    normalizedHref !== normalizedBasePath &&
    !normalizedHref.startsWith(`${normalizedBasePath}/`)
  ) {
    return yield* Effect.fail(
      new MdxPathValidationError({
        message: `Exercise href "${href}" in ${context} must start with /${normalizedBasePath}.`,
      })
    );
  }

  const relativePath = normalizedHref
    .slice(normalizedBasePath.length)
    .replace(LEADING_SLASH_REGEX, "");

  return relativePath === "" ? [] : relativePath.split("/");
});
