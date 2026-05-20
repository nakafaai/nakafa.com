import * as path from "node:path";
import {
  ARTICLE_PATH_REGEX,
  BACKSLASH_REGEX,
  LEADING_SLASH_REGEX,
  MDX_EXTENSION_REGEX,
  SUBJECT_PATH_REGEX,
} from "@repo/backend/scripts/lib/mdx-parser/constants";
import type { ExerciseParsedPath } from "@repo/backend/scripts/lib/mdx-parser/types";
import {
  MdxPathValidationError,
  parseExerciseYear,
  validateArticleCategory,
  validateExercisesCategory,
  validateExercisesMaterial,
  validateExercisesType,
  validateGrade,
  validateLocale,
  validateMaterial,
  validateSubjectCategory,
} from "@repo/backend/scripts/lib/mdx-parser/validators";
import { Effect } from "effect";

/** Builds the canonical database slug for one exercise set path. */
export const buildExerciseSetSlug = ({
  category,
  examType,
  material,
  exerciseType,
  setName,
  year,
}: Pick<
  ExerciseParsedPath,
  "category" | "examType" | "material" | "exerciseType" | "setName" | "year"
>) => {
  const pathSegments = [
    "exercises",
    category,
    examType,
    material,
    exerciseType,
  ];

  if (year !== undefined) {
    pathSegments.push(String(year));
  }

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

/** Parses a subject lesson MDX path into its sync identifiers. */
export const parseSubjectPath = Effect.fn("mdx.parseSubjectPath")(function* (
  filePath: string
) {
  const normalized = filePath.replace(BACKSLASH_REGEX, "/");
  const match = normalized.match(SUBJECT_PATH_REGEX);

  if (!match) {
    return yield* Effect.fail(
      new MdxPathValidationError({
        message: `Invalid subject path: ${filePath}`,
      })
    );
  }

  const [, rawCategory, rawGrade, rawMaterial, topic, section, rawLocale] =
    match;
  const category = yield* validateSubjectCategory(rawCategory, filePath);
  const grade = yield* validateGrade(rawGrade, filePath);
  const material = yield* validateMaterial(rawMaterial, filePath);
  const locale = yield* validateLocale(rawLocale, filePath);

  return {
    type: "subject",
    locale,
    category,
    grade,
    material,
    topic,
    section,
    slug: `subject/${category}/${grade}/${material}/${topic}/${section}`,
  };
});

/** Parses an exercise question or answer MDX path into its sync identifiers. */
export const parseExercisePath = Effect.fn("mdx.parseExercisePath")(function* (
  filePath: string
) {
  const normalized = filePath.replace(BACKSLASH_REGEX, "/");
  const pathSegments = normalized.split("/");
  const exercisesIndex = pathSegments.lastIndexOf("exercises");

  if (exercisesIndex === -1) {
    return yield* Effect.fail(
      new MdxPathValidationError({
        message: `Invalid exercise path: ${filePath}`,
      })
    );
  }

  const relativeSegments = pathSegments.slice(exercisesIndex);

  if (relativeSegments.length !== 9 && relativeSegments.length !== 10) {
    return yield* Effect.fail(
      new MdxPathValidationError({
        message: `Invalid exercise path: ${filePath}`,
      })
    );
  }

  const [, rawCategory, rawExamType, rawMaterial, exerciseType] =
    relativeSegments;
  let year: number | undefined;
  let setName: string | undefined;
  let numberStr: string | undefined;
  let questionOrAnswerDir: string | undefined;
  let rawLocaleFile: string | undefined;

  if (relativeSegments.length === 10) {
    year = yield* parseExerciseYear(relativeSegments[5], filePath);
    setName = relativeSegments[6];
    numberStr = relativeSegments[7];
    questionOrAnswerDir = relativeSegments[8];
    rawLocaleFile = relativeSegments[9];
  } else {
    setName = relativeSegments[5];
    numberStr = relativeSegments[6];
    questionOrAnswerDir = relativeSegments[7];
    rawLocaleFile = relativeSegments[8];
  }

  if (!(setName && numberStr && questionOrAnswerDir && rawLocaleFile)) {
    return yield* Effect.fail(
      new MdxPathValidationError({
        message: `Invalid exercise path: ${filePath}`,
      })
    );
  }

  if (
    questionOrAnswerDir !== "_question" &&
    questionOrAnswerDir !== "_answer"
  ) {
    return yield* Effect.fail(
      new MdxPathValidationError({
        message: `Invalid exercise path: ${filePath}`,
      })
    );
  }

  const category = yield* validateExercisesCategory(rawCategory, filePath);
  const examType = yield* validateExercisesType(rawExamType, filePath);
  const material = yield* validateExercisesMaterial(rawMaterial, filePath);
  const locale = yield* validateLocale(
    rawLocaleFile.replace(MDX_EXTENSION_REGEX, ""),
    filePath
  );
  const number = Number.parseInt(numberStr, 10);

  if (!Number.isFinite(number)) {
    return yield* Effect.fail(
      new MdxPathValidationError({
        message: `Invalid exercise number "${numberStr}" in ${filePath}.`,
      })
    );
  }

  const setSlug = buildExerciseSetSlug({
    category,
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
    isQuestion: questionOrAnswerDir === "_question",
    year,
  };
});

/** Returns the directory that contains one exercise question and answer pair. */
export const getExerciseDir = Effect.fn("mdx.getExerciseDir")(function* (
  filePath: string
) {
  const normalized = filePath.replace(BACKSLASH_REGEX, "/");
  const exerciseDir = path.posix.dirname(path.posix.dirname(normalized));

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
export const getArticleDir = (filePath: string) => path.dirname(filePath);

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
