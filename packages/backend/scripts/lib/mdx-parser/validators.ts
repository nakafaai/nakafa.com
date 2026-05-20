import { EXERCISE_YEAR_SEGMENT_REGEX } from "@repo/backend/scripts/lib/mdx-parser/constants";
import { ArticleCategorySchema } from "@repo/contents/_types/articles/category";
import { LocaleSchema } from "@repo/contents/_types/content";
import { ExercisesCategorySchema } from "@repo/contents/_types/exercises/category";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import { ExercisesTypeSchema } from "@repo/contents/_types/exercises/type";
import { SubjectCategorySchema } from "@repo/contents/_types/subject/category";
import { GradeSchema } from "@repo/contents/_types/subject/grade";
import { MaterialSchema } from "@repo/contents/_types/subject/material";
import { Effect, Schema } from "effect";

/** Identifies an invalid path segment while parsing content file paths. */
export class MdxPathValidationError extends Schema.TaggedError<MdxPathValidationError>()(
  "MdxPathValidationError",
  {
    message: Schema.String,
  }
) {}

/** Decodes one path segment with a typed schema and reports the source path. */
const parseWithSchema = Effect.fn("mdx.parseWithSchema")(function* <A, I>(
  schema: Schema.Schema<A, I, never>,
  value: string,
  filePath: string,
  message: string
) {
  return yield* Schema.decodeUnknown(schema)(value).pipe(
    Effect.mapError(
      () =>
        new MdxPathValidationError({
          message: `${message} "${value}" in ${filePath}.`,
        })
    )
  );
});

/** Validates a locale segment from a content path. */
export const validateLocale = Effect.fn("mdx.validateLocale")(function* (
  value: string,
  filePath: string
) {
  return yield* parseWithSchema(
    LocaleSchema,
    value,
    filePath,
    "Invalid locale"
  );
});

/** Validates an article category segment from a content path. */
export const validateArticleCategory = Effect.fn("mdx.validateArticleCategory")(
  function* (value: string, filePath: string) {
    return yield* parseWithSchema(
      ArticleCategorySchema,
      value,
      filePath,
      "Invalid article category"
    );
  }
);

/** Validates a subject category segment from a content path. */
export const validateSubjectCategory = Effect.fn("mdx.validateSubjectCategory")(
  function* (value: string, filePath: string) {
    return yield* parseWithSchema(
      SubjectCategorySchema,
      value,
      filePath,
      "Invalid subject category"
    );
  }
);

/** Validates a grade segment from a content path. */
export const validateGrade = Effect.fn("mdx.validateGrade")(function* (
  value: string,
  filePath: string
) {
  return yield* parseWithSchema(GradeSchema, value, filePath, "Invalid grade");
});

/** Validates a subject material segment from a content path. */
export const validateMaterial = Effect.fn("mdx.validateMaterial")(function* (
  value: string,
  filePath: string
) {
  return yield* parseWithSchema(
    MaterialSchema,
    value,
    filePath,
    "Invalid material"
  );
});

/** Validates an exercise category segment from a content path. */
export const validateExercisesCategory = Effect.fn(
  "mdx.validateExercisesCategory"
)(function* (value: string, filePath: string) {
  return yield* parseWithSchema(
    ExercisesCategorySchema,
    value,
    filePath,
    "Invalid exercises category"
  );
});

/** Validates an exercise type segment from a content path. */
export const validateExercisesType = Effect.fn("mdx.validateExercisesType")(
  function* (value: string, filePath: string) {
    return yield* parseWithSchema(
      ExercisesTypeSchema,
      value,
      filePath,
      "Invalid exercises type"
    );
  }
);

/** Validates an exercise material segment from a content path. */
export const validateExercisesMaterial = Effect.fn(
  "mdx.validateExercisesMaterial"
)(function* (value: string, filePath: string) {
  return yield* parseWithSchema(
    ExercisesMaterialSchema,
    value,
    filePath,
    "Invalid exercises material"
  );
});

/** Parses an optional four-digit exercise year path segment. */
export const parseExerciseYear = Effect.fn("mdx.parseExerciseYear")(function* (
  value: string | undefined,
  context: string
) {
  if (value === undefined) {
    return;
  }

  if (!EXERCISE_YEAR_SEGMENT_REGEX.test(value)) {
    return yield* Effect.fail(
      new MdxPathValidationError({
        message: `Invalid exercise year "${value}" in ${context}. Expected a 4-digit year segment.`,
      })
    );
  }

  return Number.parseInt(value, 10);
});
