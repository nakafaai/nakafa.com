import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Locale } from "@repo/backend/confect/modules/content/content.schemas";
import {
  BACKSLASH_REGEX,
  BASE_PATH_REGEX,
  BASE_PATH_TEMPLATE_REGEX,
  EXERCISE_MATERIAL_CONST_REGEX,
  EXERCISE_MATERIAL_PATH_REGEX,
  LAST_PATH_SEGMENT_REGEX,
  LEADING_SLASH_REGEX,
  SUBJECT_MATERIAL_CONST_REGEX,
  SUBJECT_MATERIAL_PATH_REGEX,
} from "@repo/backend/scripts/lib/mdx-parser/constants";
import { parseTypeScriptLiteral } from "@repo/backend/scripts/lib/mdx-parser/literal";
import {
  buildExerciseSetSlug,
  getRelativeExercisePathSegments,
} from "@repo/backend/scripts/lib/mdx-parser/paths";
import type { ParsedExerciseSet } from "@repo/backend/scripts/lib/mdx-parser/types";
import {
  parseExerciseYear,
  validateExercisesCategory,
  validateExercisesMaterial,
  validateExercisesType,
  validateGrade,
  validateMaterial,
  validateSubjectCategory,
} from "@repo/backend/scripts/lib/mdx-parser/validators";
import { ExercisesMaterialListSchema } from "@repo/contents/_types/exercises/material";
import { MaterialListSchema } from "@repo/contents/_types/subject/material";
import { Effect, Schema } from "effect";

class MaterialReadError extends Schema.TaggedError<MaterialReadError>()(
  "MaterialReadError",
  {
    message: Schema.String,
  }
) {}

const getUnknownMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const readBasePath = Effect.fn("mdx.readBasePath")(function* (
  materialFilePath: string,
  fallbackBasePath: string
) {
  const pathFile = path.join(path.dirname(materialFilePath), "path.ts");
  const file = yield* Effect.either(
    Effect.tryPromise({
      try: () => fs.readFile(pathFile, "utf8"),
      catch: (error) =>
        new MaterialReadError({ message: getUnknownMessage(error) }),
    })
  );

  if (file._tag === "Left") {
    return fallbackBasePath;
  }

  const basePathMatch = file.right.match(BASE_PATH_REGEX);

  if (!basePathMatch) {
    return fallbackBasePath;
  }

  return basePathMatch[1].replace(LEADING_SLASH_REGEX, "");
});

const readTypedArray = Effect.fn("mdx.readTypedArray")(function* <A, I>(
  content: string,
  arrayRegex: RegExp,
  basePath: string,
  parser: Schema.Schema<A, I, never>,
  filePath: string,
  emptyValue: A
) {
  const constMatch = content.match(arrayRegex);

  if (!constMatch) {
    return emptyValue;
  }

  const arrayWithBasePath = constMatch[1].replace(
    BASE_PATH_TEMPLATE_REGEX,
    `/${basePath}`
  );
  const parsedArray = yield* parseTypeScriptLiteral(arrayWithBasePath).pipe(
    Effect.mapError(
      (error) =>
        new MaterialReadError({
          message: `Invalid material file ${filePath}: ${error.message}`,
        })
    )
  );
  const parseResult = Schema.decodeUnknownEither(parser)(parsedArray);

  if (parseResult._tag === "Left") {
    return yield* Effect.fail(
      new MaterialReadError({
        message: `Invalid material file ${filePath}: ${parseResult.left.message}`,
      })
    );
  }

  return parseResult.right;
});

/** Parses one exercise material module into sync-ready exercise sets. */
export const parseExerciseMaterialFile = Effect.fn(
  "mdx.parseExerciseMaterialFile"
)(function* (materialFilePath: string, locale: Locale) {
  const normalized = materialFilePath.replace(BACKSLASH_REGEX, "/");
  const pathMatch = normalized.match(EXERCISE_MATERIAL_PATH_REGEX);

  if (!pathMatch) {
    return yield* Effect.fail(
      new MaterialReadError({
        message: `Invalid material file path: ${materialFilePath}`,
      })
    );
  }

  const [, rawCategory, rawType, rawMaterial] = pathMatch;
  const category = yield* validateExercisesCategory(
    rawCategory,
    materialFilePath
  );
  const type = yield* validateExercisesType(rawType, materialFilePath);
  const material = yield* validateExercisesMaterial(
    rawMaterial,
    materialFilePath
  );
  const fallbackBasePath = `exercises/${category}/${type}/${material}`;
  const basePath = yield* readBasePath(materialFilePath, fallbackBasePath);
  const content = yield* Effect.tryPromise({
    try: () => fs.readFile(materialFilePath, "utf8"),
    catch: (error) =>
      new MaterialReadError({ message: getUnknownMessage(error) }),
  });
  const exerciseTypeGroups = yield* readTypedArray(
    content,
    EXERCISE_MATERIAL_CONST_REGEX,
    basePath,
    ExercisesMaterialListSchema,
    materialFilePath,
    []
  );
  const sets: ParsedExerciseSet[] = [];

  for (const exerciseTypeGroup of exerciseTypeGroups) {
    const groupSegments = yield* getRelativeExercisePathSegments(
      basePath,
      exerciseTypeGroup.href,
      materialFilePath
    );

    if (groupSegments.length === 0 || groupSegments.length > 2) {
      return yield* Effect.fail(
        new MaterialReadError({
          message: `Invalid exercise group href "${exerciseTypeGroup.href}" in ${materialFilePath}.`,
        })
      );
    }

    const [exerciseType, rawYear] = groupSegments;

    if (!exerciseType) {
      return yield* Effect.fail(
        new MaterialReadError({
          message: `Invalid exercise group href "${exerciseTypeGroup.href}" in ${materialFilePath}.`,
        })
      );
    }

    const year = yield* parseExerciseYear(rawYear, materialFilePath);

    for (const setItem of exerciseTypeGroup.items) {
      const itemSegments = yield* getRelativeExercisePathSegments(
        basePath,
        setItem.href,
        materialFilePath
      );
      const expectedPrefix =
        year === undefined ? [exerciseType] : [exerciseType, String(year)];
      const hasExpectedPrefix = expectedPrefix.every(
        (segment, index) => itemSegments[index] === segment
      );

      if (
        itemSegments.length !== expectedPrefix.length + 1 ||
        !hasExpectedPrefix
      ) {
        return yield* Effect.fail(
          new MaterialReadError({
            message: `Invalid exercise set href "${setItem.href}" in ${materialFilePath}.`,
          })
        );
      }

      const setName = itemSegments.at(-1);

      if (!setName) {
        return yield* Effect.fail(
          new MaterialReadError({
            message: `Invalid exercise set href "${setItem.href}" in ${materialFilePath}.`,
          })
        );
      }

      sets.push({
        locale,
        slug: buildExerciseSetSlug({
          category,
          examType: type,
          material,
          exerciseType,
          setName,
          year,
        }),
        category,
        type,
        material,
        exerciseType,
        exerciseTypeTitle: exerciseTypeGroup.title,
        setName,
        title: setItem.title,
        description: exerciseTypeGroup.description,
        year,
      });
    }
  }

  return sets;
});

/** Parses one subject material module into sync-ready subject topics. */
export const parseSubjectMaterialFile = Effect.fn(
  "mdx.parseSubjectMaterialFile"
)(function* (materialFilePath: string, locale: Locale) {
  const normalized = materialFilePath.replace(BACKSLASH_REGEX, "/");
  const pathMatch = normalized.match(SUBJECT_MATERIAL_PATH_REGEX);

  if (!pathMatch) {
    return yield* Effect.fail(
      new MaterialReadError({
        message: `Invalid subject material file path: ${materialFilePath}`,
      })
    );
  }

  const [, rawCategory, rawGrade, rawMaterial] = pathMatch;
  const category = yield* validateSubjectCategory(
    rawCategory,
    materialFilePath
  );
  const grade = yield* validateGrade(rawGrade, materialFilePath);
  const material = yield* validateMaterial(rawMaterial, materialFilePath);
  const fallbackBasePath = `subject/${category}/${grade}/${material}`;
  const basePath = yield* readBasePath(materialFilePath, fallbackBasePath);
  const content = yield* Effect.tryPromise({
    try: () => fs.readFile(materialFilePath, "utf8"),
    catch: (error) =>
      new MaterialReadError({ message: getUnknownMessage(error) }),
  });
  const topicGroups = yield* readTypedArray(
    content,
    SUBJECT_MATERIAL_CONST_REGEX,
    basePath,
    MaterialListSchema,
    materialFilePath,
    []
  );

  return topicGroups.map((topicGroup) => {
    const topic = topicGroup.href.match(LAST_PATH_SEGMENT_REGEX)?.[1] ?? "";

    return {
      locale,
      slug: `${basePath}/${topic}`,
      category,
      grade,
      material,
      topic,
      title: topicGroup.title,
      description: topicGroup.description,
      sectionCount: topicGroup.items.length,
    };
  });
});
