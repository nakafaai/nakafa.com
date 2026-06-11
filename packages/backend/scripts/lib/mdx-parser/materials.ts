import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import {
  BACKSLASH_REGEX,
  BASE_PATH_REGEX,
  BASE_PATH_TEMPLATE_REGEX,
  EXERCISE_MATERIAL_CONST_REGEX,
  EXERCISE_MATERIAL_PATH_REGEX,
  LEADING_SLASH_REGEX,
  SUBJECT_MATERIAL_CONST_REGEX,
  SUBJECT_MATERIAL_PATH_REGEX,
} from "@repo/backend/scripts/lib/mdx-parser/constants";
import {
  buildExerciseSetSlug,
  getRelativeExercisePathSegments,
} from "@repo/backend/scripts/lib/mdx-parser/paths";
import type {
  ParsedExerciseSet,
  ParsedSubjectSection,
  ParsedSubjectTopic,
} from "@repo/backend/scripts/lib/mdx-parser/types";
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

/** Returns one material href as clean segments below its material base path. */
const getRelativeSubjectPathSegments = Effect.fn(
  "mdx.getRelativeSubjectPathSegments"
)(function* (basePath: string, href: string, filePath: string) {
  const normalizedBasePath = basePath.replace(LEADING_SLASH_REGEX, "");
  const normalizedHref = href.replace(LEADING_SLASH_REGEX, "");

  if (!normalizedHref.startsWith(`${normalizedBasePath}/`)) {
    return yield* Effect.fail(
      new MaterialReadError({
        message: `Invalid subject material href "${href}" in ${filePath}.`,
      })
    );
  }

  return normalizedHref.slice(normalizedBasePath.length + 1).split("/");
});

const readBasePath = Effect.fn("mdx.readBasePath")(function* (
  materialFilePath: string,
  fallbackBasePath: string
) {
  const pathFile = join(dirname(materialFilePath), "path.ts");
  const file = yield* Effect.either(
    Effect.tryPromise({
      try: () => readFile(pathFile, "utf8"),
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
  const parsedArray = yield* Effect.try({
    try: () => new Function(`return ${arrayWithBasePath}`)(),
    catch: (error) =>
      new MaterialReadError({
        message: `Invalid material file ${filePath}: ${getUnknownMessage(error)}`,
      }),
  });
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
    try: () => readFile(materialFilePath, "utf8"),
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
    try: () => readFile(materialFilePath, "utf8"),
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
  const topics: ParsedSubjectTopic[] = [];
  const seenTopics = new Set<string>();

  for (const [topicOrder, topicGroup] of topicGroups.entries()) {
    const topicSegments = yield* getRelativeSubjectPathSegments(
      basePath,
      topicGroup.href,
      materialFilePath
    );

    if (topicSegments.length !== 1) {
      return yield* Effect.fail(
        new MaterialReadError({
          message: `Invalid subject topic href "${topicGroup.href}" in ${materialFilePath}.`,
        })
      );
    }

    const [topic] = topicSegments;

    if (!topic) {
      return yield* Effect.fail(
        new MaterialReadError({
          message: `Invalid subject topic href "${topicGroup.href}" in ${materialFilePath}.`,
        })
      );
    }

    if (seenTopics.has(topic)) {
      return yield* Effect.fail(
        new MaterialReadError({
          message: `Duplicate subject topic href "${topicGroup.href}" in ${materialFilePath}.`,
        })
      );
    }

    seenTopics.add(topic);
    const sections: ParsedSubjectSection[] = [];
    const seenSections = new Set<string>();

    for (const [sectionOrder, item] of topicGroup.items.entries()) {
      const sectionSegments = yield* getRelativeSubjectPathSegments(
        basePath,
        item.href,
        materialFilePath
      );

      if (sectionSegments.length !== 2 || sectionSegments[0] !== topic) {
        return yield* Effect.fail(
          new MaterialReadError({
            message: `Invalid subject section href "${item.href}" in ${materialFilePath}.`,
          })
        );
      }

      const section = sectionSegments[1];

      if (!section) {
        return yield* Effect.fail(
          new MaterialReadError({
            message: `Invalid subject section href "${item.href}" in ${materialFilePath}.`,
          })
        );
      }

      if (seenSections.has(section)) {
        return yield* Effect.fail(
          new MaterialReadError({
            message: `Duplicate subject section href "${item.href}" in ${materialFilePath}.`,
          })
        );
      }

      seenSections.add(section);
      sections.push({
        order: sectionOrder,
        section,
        slug: `${basePath}/${topic}/${section}`,
      });
    }

    topics.push({
      locale,
      slug: `${basePath}/${topic}`,
      category,
      grade,
      material,
      order: topicOrder,
      topic,
      title: topicGroup.title,
      description: topicGroup.description,
      sections,
    });
  }

  return topics;
});
