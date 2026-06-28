import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CONST_CHOICES_REGEX,
  DEFAULT_EXPORT_REGEX,
  METADATA_REGEX,
  MULTIPLE_NEWLINES_REGEX,
  REFERENCES_REGEX,
} from "@repo/backend/scripts/lib/mdx-parser/constants";
import { parseContentDate } from "@repo/contents/_shared/date";
import { ExercisesChoicesSchema } from "@repo/contents/_types/assessment/choices";
import {
  ContentMetadataSchema,
  type Reference,
  ReferenceSchema,
} from "@repo/contents/_types/content";
import { Effect, Option, Schema } from "effect";

class MdxReadError extends Schema.TaggedError<MdxReadError>()("MdxReadError", {
  message: Schema.String,
}) {}

/** Normalizes MDX body spacing before hashing and syncing. */
const normalizeWhitespace = (content: string) =>
  content.replace(MULTIPLE_NEWLINES_REGEX, "\n\n").trim();

/** Computes the stable content hash sent to Convex sync mutations. */
export const computeHash = (content: string) =>
  createHash("sha256").update(content, "utf8").digest("hex");

/** Parses a content metadata date into an epoch millisecond timestamp. */
export const parseDateToEpoch = Effect.fn("mdx.parseDateToEpoch")(function* (
  dateStr: string
) {
  const date = parseContentDate(dateStr);

  if (Option.isNone(date)) {
    return yield* Effect.fail(
      new MdxReadError({
        message: `Invalid date format: ${dateStr}. Expected YYYY-MM-DD`,
      })
    );
  }

  return date.value.getTime();
});

/** Parses one MDX source string into metadata, normalized body, and body hash. */
export const parseMdxContent = Effect.fn("mdx.parseMdxContent")(function* (
  content: string
) {
  const match = content.match(METADATA_REGEX);

  if (!match) {
    return yield* Effect.fail(
      new MdxReadError({ message: "No metadata export found in MDX file" })
    );
  }

  const metadataObject = yield* Effect.try({
    try: () => new Function(`return ${match[1]}`)(),
    catch: (error) =>
      new MdxReadError({
        message: error instanceof Error ? error.message : String(error),
      }),
  });
  const metadata = yield* Schema.decodeUnknown(ContentMetadataSchema)(
    metadataObject
  ).pipe(
    Effect.mapError(
      (error) =>
        new MdxReadError({ message: `Invalid metadata: ${error.message}` })
    )
  );

  const body = normalizeWhitespace(content.replace(METADATA_REGEX, ""));

  return {
    metadata,
    body,
    contentHash: computeHash(body),
  };
});

/** Reads and parses one MDX file through an Effect filesystem boundary. */
export const readMdxFile = Effect.fn("mdx.readMdxFile")(function* (
  filePath: string
) {
  const content = yield* Effect.tryPromise({
    try: () => readFile(filePath, "utf8"),
    catch: (error) =>
      new MdxReadError({
        message: error instanceof Error ? error.message : String(error),
      }),
  });
  const parsed = yield* parseMdxContent(content);

  return {
    ...parsed,
    filePath,
  };
});

/** Reads optional exercise choices, returning null when no valid choices exist. */
export const readExerciseChoices = Effect.fn("mdx.readExerciseChoices")(
  function* (exerciseDir: string) {
    const choicesPath = join(exerciseDir, "choices.ts");
    const file = yield* Effect.either(
      Effect.tryPromise({
        try: () => readFile(choicesPath, "utf8"),
        catch: (error) =>
          new MdxReadError({
            message: error instanceof Error ? error.message : String(error),
          }),
      })
    );

    if (file._tag === "Left") {
      return null;
    }

    const objectMatch =
      file.right.match(DEFAULT_EXPORT_REGEX) ??
      file.right.match(CONST_CHOICES_REGEX);

    if (!objectMatch) {
      return null;
    }

    const choicesObject = yield* Effect.either(
      Effect.try({
        try: () => new Function(`return ${objectMatch[1]}`)(),
        catch: (error) =>
          new MdxReadError({
            message: error instanceof Error ? error.message : String(error),
          }),
      })
    );

    if (choicesObject._tag === "Left") {
      return null;
    }

    const parseResult = Schema.decodeUnknownOption(ExercisesChoicesSchema)(
      choicesObject.right
    );

    if (parseResult._tag === "None") {
      return null;
    }

    return parseResult.value;
  }
);

/** Reads optional article references, dropping invalid entries instead of failing sync. */
export const readArticleReferences = Effect.fn("mdx.readArticleReferences")(
  function* (articleDir: string) {
    const refPath = join(articleDir, "ref.ts");
    const file = yield* Effect.either(
      Effect.tryPromise({
        try: () => readFile(refPath, "utf8"),
        catch: (error) =>
          new MdxReadError({
            message: error instanceof Error ? error.message : String(error),
          }),
      })
    );

    if (file._tag === "Left") {
      return [];
    }

    const match = file.right.match(REFERENCES_REGEX);

    if (!match) {
      return [];
    }

    const referencesArray = yield* Effect.either(
      Effect.try({
        try: () => new Function(`return ${match[1]}`)(),
        catch: (error) =>
          new MdxReadError({
            message: error instanceof Error ? error.message : String(error),
          }),
      })
    );

    if (
      referencesArray._tag === "Left" ||
      !Array.isArray(referencesArray.right)
    ) {
      return [];
    }

    const validReferences: Reference[] = [];

    for (const reference of referencesArray.right) {
      const parseResult =
        Schema.decodeUnknownOption(ReferenceSchema)(reference);

      if (parseResult._tag === "Some") {
        validReferences.push(parseResult.value);
      }
    }

    return validReferences;
  }
);
