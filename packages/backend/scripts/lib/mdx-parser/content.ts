import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  CONST_CHOICES_REGEX,
  DEFAULT_EXPORT_REGEX,
  METADATA_REGEX,
  MULTIPLE_NEWLINES_REGEX,
  REFERENCES_REGEX,
} from "@repo/backend/scripts/lib/mdx-parser/constants";
import type { ParsedMdx } from "@repo/backend/scripts/lib/mdx-parser/types";
import { parseContentDate } from "@repo/contents/_shared/date";
import {
  ContentMetadataSchema,
  type Reference,
  ReferenceSchema,
} from "@repo/contents/_types/content";
import { ExercisesChoicesSchema } from "@repo/contents/_types/exercises/choices";
import { Effect, Schema } from "effect";

class MdxReadError extends Schema.TaggedError<MdxReadError>()("MdxReadError", {
  message: Schema.String,
}) {}

function normalizeWhitespace(content: string) {
  return content.replace(MULTIPLE_NEWLINES_REGEX, "\n\n").trim();
}

export function computeHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function parseDateToEpoch(dateStr: string): number {
  const date = parseContentDate(dateStr);

  if (!date) {
    throw new Error(`Invalid date format: ${dateStr}. Expected MM/DD/YYYY`);
  }

  return date.getTime();
}

export function parseMdxContent(content: string): ParsedMdx {
  const match = content.match(METADATA_REGEX);

  if (!match) {
    throw new Error("No metadata export found in MDX file");
  }

  const metadataObject = new Function(`return ${match[1]}`)();
  const parseResult = ContentMetadataSchema.safeParse(metadataObject);

  if (!parseResult.success) {
    throw new Error(`Invalid metadata: ${parseResult.error.message}`);
  }

  const body = normalizeWhitespace(content.replace(METADATA_REGEX, ""));

  return {
    metadata: parseResult.data,
    body,
    contentHash: computeHash(body),
  };
}

/** Reads and parses one MDX file through an Effect filesystem boundary. */
export const readMdxFile = Effect.fn("mdx.readMdxFile")(function* (
  filePath: string
) {
  const content = yield* Effect.tryPromise({
    try: () => fs.readFile(filePath, "utf8"),
    catch: (error) =>
      new MdxReadError({
        message: error instanceof Error ? error.message : String(error),
      }),
  });
  const parsed = yield* Effect.try({
    try: () => parseMdxContent(content),
    catch: (error) =>
      new MdxReadError({
        message: error instanceof Error ? error.message : String(error),
      }),
  });

  return {
    ...parsed,
    filePath,
  };
});

/** Reads optional exercise choices, returning null when no valid choices exist. */
export const readExerciseChoices = Effect.fn("mdx.readExerciseChoices")(
  function* (exerciseDir: string) {
    const choicesPath = path.join(exerciseDir, "choices.ts");
    const file = yield* Effect.either(
      Effect.tryPromise({
        try: () => fs.readFile(choicesPath, "utf8"),
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

    const parseResult = ExercisesChoicesSchema.safeParse(choicesObject.right);

    if (!parseResult.success) {
      return null;
    }

    return parseResult.data;
  }
);

/** Reads optional article references, dropping invalid entries instead of failing sync. */
export const readArticleReferences = Effect.fn("mdx.readArticleReferences")(
  function* (articleDir: string) {
    const refPath = path.join(articleDir, "ref.ts");
    const file = yield* Effect.either(
      Effect.tryPromise({
        try: () => fs.readFile(refPath, "utf8"),
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
      const parseResult = ReferenceSchema.safeParse(reference);

      if (parseResult.success) {
        validReferences.push(parseResult.data);
      }
    }

    return validReferences;
  }
);
