import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import {
  type ArticleCategory,
  ArticleCategorySchema,
} from "@repo/contents/_types/articles/category";
import {
  type ExercisesCategory,
  ExercisesCategorySchema,
} from "@repo/contents/_types/exercises/category";
import {
  type ExercisesMaterial,
  ExercisesMaterialSchema,
} from "@repo/contents/_types/exercises/material";
import {
  type ExercisesType,
  ExercisesTypeSchema,
} from "@repo/contents/_types/exercises/type";
import {
  type SubjectCategory,
  SubjectCategorySchema,
} from "@repo/contents/_types/subject/category";
import { type Grade, GradeSchema } from "@repo/contents/_types/subject/grade";
import {
  type Material,
  MaterialSchema,
} from "@repo/contents/_types/subject/material";
import * as z from "zod";
import { EXERCISE_YEAR_SEGMENT_REGEX } from "./constants";

const LocaleSchema = z.union([z.literal("en"), z.literal("id")]);

function parseWithSchema<T>(
  schema: z.ZodType<T>,
  value: string,
  filePath: string,
  message: string
) {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new Error(`${message} "${value}" in ${filePath}.`);
  }

  return result.data;
}

export function validateLocale(value: string, filePath: string): Locale {
  return parseWithSchema(LocaleSchema, value, filePath, "Invalid locale");
}

export function validateArticleCategory(
  value: string,
  filePath: string
): ArticleCategory {
  return parseWithSchema(
    ArticleCategorySchema,
    value,
    filePath,
    "Invalid article category"
  );
}

export function validateSubjectCategory(
  value: string,
  filePath: string
): SubjectCategory {
  return parseWithSchema(
    SubjectCategorySchema,
    value,
    filePath,
    "Invalid subject category"
  );
}

export function validateGrade(value: string, filePath: string): Grade {
  return parseWithSchema(GradeSchema, value, filePath, "Invalid grade");
}

export function validateMaterial(value: string, filePath: string): Material {
  return parseWithSchema(MaterialSchema, value, filePath, "Invalid material");
}

export function validateExercisesCategory(
  value: string,
  filePath: string
): ExercisesCategory {
  return parseWithSchema(
    ExercisesCategorySchema,
    value,
    filePath,
    "Invalid exercises category"
  );
}

export function validateExercisesType(
  value: string,
  filePath: string
): ExercisesType {
  return parseWithSchema(
    ExercisesTypeSchema,
    value,
    filePath,
    "Invalid exercises type"
  );
}

export function validateExercisesMaterial(
  value: string,
  filePath: string
): ExercisesMaterial {
  return parseWithSchema(
    ExercisesMaterialSchema,
    value,
    filePath,
    "Invalid exercises material"
  );
}

export function parseExerciseYear(value: string | undefined, context: string) {
  if (value === undefined) {
    return undefined;
  }

  if (!EXERCISE_YEAR_SEGMENT_REGEX.test(value)) {
    throw new Error(
      `Invalid exercise year "${value}" in ${context}. Expected a 4-digit year segment.`
    );
  }

  return Number.parseInt(value, 10);
}
