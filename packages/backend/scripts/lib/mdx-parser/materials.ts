import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { ExercisesMaterialListSchema } from "@repo/contents/_types/exercises/material";
import { MaterialListSchema } from "@repo/contents/_types/subject/material";
import type * as z from "zod";
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
} from "./constants";
import { buildExerciseSetSlug, getRelativeExercisePathSegments } from "./paths";
import type { ParsedExerciseSet, ParsedSubjectTopic } from "./types";
import {
  parseExerciseYear,
  validateExercisesCategory,
  validateExercisesMaterial,
  validateExercisesType,
  validateGrade,
  validateMaterial,
  validateSubjectCategory,
} from "./validators";

async function readBasePath(
  materialFilePath: string,
  fallbackBasePath: string
) {
  const indexPath = path.join(path.dirname(materialFilePath), "index.ts");

  try {
    const indexContent = await fs.readFile(indexPath, "utf8");
    const basePathMatch = indexContent.match(BASE_PATH_REGEX);

    if (!basePathMatch) {
      return fallbackBasePath;
    }

    return basePathMatch[1].replace(LEADING_SLASH_REGEX, "");
  } catch {
    return fallbackBasePath;
  }
}

function readTypedArray<T>(
  content: string,
  arrayRegex: RegExp,
  basePath: string,
  parser: z.ZodType<T>,
  filePath: string,
  emptyValue: T
): T {
  const constMatch = content.match(arrayRegex);

  if (!constMatch) {
    return emptyValue;
  }

  const arrayWithBasePath = constMatch[1].replace(
    BASE_PATH_TEMPLATE_REGEX,
    `/${basePath}`
  );
  const parsedArray = new Function(`return ${arrayWithBasePath}`)();
  const parseResult = parser.safeParse(parsedArray);

  if (!parseResult.success) {
    console.warn(
      `Invalid material file ${filePath}: ${parseResult.error?.message ?? "Unknown error"}`
    );
    return emptyValue;
  }

  return parseResult.data;
}

export async function parseExerciseMaterialFile(
  materialFilePath: string,
  locale: Locale
): Promise<ParsedExerciseSet[]> {
  const normalized = materialFilePath.replace(BACKSLASH_REGEX, "/");
  const pathMatch = normalized.match(EXERCISE_MATERIAL_PATH_REGEX);

  if (!pathMatch) {
    throw new Error(`Invalid material file path: ${materialFilePath}`);
  }

  const [, rawCategory, rawType, rawMaterial] = pathMatch;
  const category = validateExercisesCategory(rawCategory, materialFilePath);
  const type = validateExercisesType(rawType, materialFilePath);
  const material = validateExercisesMaterial(rawMaterial, materialFilePath);
  const fallbackBasePath = `exercises/${category}/${type}/${material}`;
  const basePath = await readBasePath(materialFilePath, fallbackBasePath);
  const content = await fs.readFile(materialFilePath, "utf8");
  const exerciseTypeGroups = readTypedArray(
    content,
    EXERCISE_MATERIAL_CONST_REGEX,
    basePath,
    ExercisesMaterialListSchema,
    materialFilePath,
    []
  );
  const sets: ParsedExerciseSet[] = [];

  for (const exerciseTypeGroup of exerciseTypeGroups) {
    const groupSegments = getRelativeExercisePathSegments(
      basePath,
      exerciseTypeGroup.href,
      materialFilePath
    );

    if (groupSegments.length === 0 || groupSegments.length > 2) {
      throw new Error(
        `Invalid exercise group href "${exerciseTypeGroup.href}" in ${materialFilePath}.`
      );
    }

    const [exerciseType, rawYear] = groupSegments;

    if (!exerciseType) {
      throw new Error(
        `Invalid exercise group href "${exerciseTypeGroup.href}" in ${materialFilePath}.`
      );
    }

    const year = parseExerciseYear(rawYear, materialFilePath);

    for (const setItem of exerciseTypeGroup.items) {
      const itemSegments = getRelativeExercisePathSegments(
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
        throw new Error(
          `Invalid exercise set href "${setItem.href}" in ${materialFilePath}.`
        );
      }

      const setName = itemSegments.at(-1);

      if (!setName) {
        throw new Error(
          `Invalid exercise set href "${setItem.href}" in ${materialFilePath}.`
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
        setName,
        title: setItem.title,
        description: exerciseTypeGroup.description,
        year,
      });
    }
  }

  return sets;
}

export async function parseSubjectMaterialFile(
  materialFilePath: string,
  locale: Locale
): Promise<ParsedSubjectTopic[]> {
  const normalized = materialFilePath.replace(BACKSLASH_REGEX, "/");
  const pathMatch = normalized.match(SUBJECT_MATERIAL_PATH_REGEX);

  if (!pathMatch) {
    throw new Error(`Invalid subject material file path: ${materialFilePath}`);
  }

  const [, rawCategory, rawGrade, rawMaterial] = pathMatch;
  const category = validateSubjectCategory(rawCategory, materialFilePath);
  const grade = validateGrade(rawGrade, materialFilePath);
  const material = validateMaterial(rawMaterial, materialFilePath);
  const fallbackBasePath = `subject/${category}/${grade}/${material}`;
  const basePath = await readBasePath(materialFilePath, fallbackBasePath);
  const content = await fs.readFile(materialFilePath, "utf8");
  const topicGroups = readTypedArray(
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
}
