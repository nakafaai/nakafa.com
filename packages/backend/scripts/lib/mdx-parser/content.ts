import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseContentDate } from "@repo/contents/_shared/date";
import {
  ContentMetadataSchema,
  type Reference,
  ReferenceSchema,
} from "@repo/contents/_types/content";
import { ExercisesChoicesSchema } from "@repo/contents/_types/exercises/choices";
import {
  CONST_CHOICES_REGEX,
  DEFAULT_EXPORT_REGEX,
  METADATA_REGEX,
  MULTIPLE_NEWLINES_REGEX,
  REFERENCES_REGEX,
} from "./constants";
import type { ExerciseChoicesByLocale, ParsedMdx } from "./types";

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

export async function readMdxFile(
  filePath: string
): Promise<ParsedMdx & { filePath: string }> {
  const content = await fs.readFile(filePath, "utf8");
  return {
    ...parseMdxContent(content),
    filePath,
  };
}

export async function readExerciseChoices(
  exerciseDir: string
): Promise<ExerciseChoicesByLocale | null> {
  const choicesPath = path.join(exerciseDir, "choices.ts");

  try {
    const content = await fs.readFile(choicesPath, "utf8");
    const objectMatch =
      content.match(DEFAULT_EXPORT_REGEX) ?? content.match(CONST_CHOICES_REGEX);

    if (!objectMatch) {
      return null;
    }

    const choicesObject = new Function(`return ${objectMatch[1]}`)();
    const parseResult = ExercisesChoicesSchema.safeParse(choicesObject);

    if (!parseResult.success) {
      console.warn(
        `Invalid choices at ${choicesPath}: ${parseResult.error.message}`
      );
      return null;
    }

    return parseResult.data;
  } catch {
    return null;
  }
}

export async function readArticleReferences(
  articleDir: string
): Promise<Reference[]> {
  const refPath = path.join(articleDir, "ref.ts");

  try {
    const content = await fs.readFile(refPath, "utf8");
    const match = content.match(REFERENCES_REGEX);

    if (!match) {
      return [];
    }

    const referencesArray = new Function(`return ${match[1]}`)();

    if (!Array.isArray(referencesArray)) {
      return [];
    }

    const validReferences: Reference[] = [];

    for (const reference of referencesArray) {
      const parseResult = ReferenceSchema.safeParse(reference);

      if (parseResult.success) {
        validReferences.push(parseResult.data);
      } else {
        console.warn(
          `Invalid reference in ${refPath}: ${parseResult.error.message}`
        );
      }
    }

    return validReferences;
  } catch {
    return [];
  }
}
