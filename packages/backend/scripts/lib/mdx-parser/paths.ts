import * as path from "node:path";
import {
  ARTICLE_PATH_REGEX,
  BACKSLASH_REGEX,
  LEADING_SLASH_REGEX,
  MDX_EXTENSION_REGEX,
  SUBJECT_PATH_REGEX,
} from "@repo/backend/scripts/lib/mdx-parser/constants";
import type {
  ArticleParsedPath,
  ExerciseParsedPath,
  SubjectParsedPath,
} from "@repo/backend/scripts/lib/mdx-parser/types";
import {
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

export function buildExerciseSetSlug({
  category,
  examType,
  material,
  exerciseType,
  setName,
  year,
}: Pick<
  ExerciseParsedPath,
  "category" | "examType" | "material" | "exerciseType" | "setName" | "year"
>) {
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
}

export function parseArticlePath(filePath: string): ArticleParsedPath {
  const normalized = filePath.replace(BACKSLASH_REGEX, "/");
  const match = normalized.match(ARTICLE_PATH_REGEX);

  if (!match) {
    throw new Error(`Invalid article path: ${filePath}`);
  }

  const [, rawCategory, articleSlug, rawLocale] = match;
  const category = validateArticleCategory(rawCategory.toLowerCase(), filePath);
  const locale = validateLocale(rawLocale, filePath);

  return {
    type: "article",
    locale,
    category,
    articleSlug,
    slug: `articles/${category}/${articleSlug}`,
  };
}

export function parseSubjectPath(filePath: string): SubjectParsedPath {
  const normalized = filePath.replace(BACKSLASH_REGEX, "/");
  const match = normalized.match(SUBJECT_PATH_REGEX);

  if (!match) {
    throw new Error(`Invalid subject path: ${filePath}`);
  }

  const [, rawCategory, rawGrade, rawMaterial, topic, section, rawLocale] =
    match;
  const category = validateSubjectCategory(rawCategory, filePath);
  const grade = validateGrade(rawGrade, filePath);
  const material = validateMaterial(rawMaterial, filePath);
  const locale = validateLocale(rawLocale, filePath);

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
}

export function parseExercisePath(filePath: string): ExerciseParsedPath {
  const normalized = filePath.replace(BACKSLASH_REGEX, "/");
  const pathSegments = normalized.split("/");
  const exercisesIndex = pathSegments.lastIndexOf("exercises");

  if (exercisesIndex === -1) {
    throw new Error(`Invalid exercise path: ${filePath}`);
  }

  const relativeSegments = pathSegments.slice(exercisesIndex);

  if (relativeSegments.length !== 9 && relativeSegments.length !== 10) {
    throw new Error(`Invalid exercise path: ${filePath}`);
  }

  const [, rawCategory, rawExamType, rawMaterial, exerciseType] =
    relativeSegments;
  let year: number | undefined;
  let setName: string | undefined;
  let numberStr: string | undefined;
  let questionOrAnswerDir: string | undefined;
  let rawLocaleFile: string | undefined;

  if (relativeSegments.length === 10) {
    year = parseExerciseYear(relativeSegments[5], filePath);
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
    throw new Error(`Invalid exercise path: ${filePath}`);
  }

  if (
    questionOrAnswerDir !== "_question" &&
    questionOrAnswerDir !== "_answer"
  ) {
    throw new Error(`Invalid exercise path: ${filePath}`);
  }

  const category = validateExercisesCategory(rawCategory, filePath);
  const examType = validateExercisesType(rawExamType, filePath);
  const material = validateExercisesMaterial(rawMaterial, filePath);
  const locale = validateLocale(
    rawLocaleFile.replace(MDX_EXTENSION_REGEX, ""),
    filePath
  );
  const number = Number.parseInt(numberStr, 10);

  if (!Number.isFinite(number)) {
    throw new Error(`Invalid exercise number "${numberStr}" in ${filePath}.`);
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
}

export function getExerciseDir(filePath: string): string {
  const normalized = filePath.replace(BACKSLASH_REGEX, "/");
  const exerciseDir = path.posix.dirname(path.posix.dirname(normalized));

  if (exerciseDir === "." || exerciseDir === "/") {
    throw new Error(`Cannot extract exercise directory from: ${filePath}`);
  }

  return exerciseDir;
}

export function getArticleDir(filePath: string): string {
  return path.dirname(filePath);
}

export function getRelativeExercisePathSegments(
  basePath: string,
  href: string,
  context: string
) {
  const normalizedBasePath = basePath.replace(LEADING_SLASH_REGEX, "");
  const normalizedHref = href.replace(LEADING_SLASH_REGEX, "");

  if (
    normalizedHref !== normalizedBasePath &&
    !normalizedHref.startsWith(`${normalizedBasePath}/`)
  ) {
    throw new Error(
      `Exercise href "${href}" in ${context} must start with /${normalizedBasePath}.`
    );
  }

  const relativePath = normalizedHref
    .slice(normalizedBasePath.length)
    .replace(LEADING_SLASH_REGEX, "");

  return relativePath === "" ? [] : relativePath.split("/");
}
