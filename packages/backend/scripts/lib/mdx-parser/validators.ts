import { ArticleCategorySchema } from "@repo/contents/_types/articles/category";
import { LocaleSchema } from "@repo/contents/_types/content";
import { SubjectCategorySchema } from "@repo/contents/_types/curriculum/category";
import { GradeSchema } from "@repo/contents/_types/curriculum/grade";
import { MaterialSchema } from "@repo/contents/_types/curriculum/material";
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

/** Validates a material lesson segment from a content path. */
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
