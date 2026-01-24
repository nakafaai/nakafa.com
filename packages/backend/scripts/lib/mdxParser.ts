import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Locale } from "@repo/backend/convex/lib/contentValidators";
import {
  type ContentMetadata,
  ContentMetadataSchema,
  type Reference,
  ReferenceSchema,
} from "@repo/contents/_types/content";
import { ExercisesChoicesSchema } from "@repo/contents/_types/exercises/choices";

interface ParsedMdx {
  metadata: ContentMetadata;
  body: string;
  contentHash: string;
}

interface ArticleParsedPath {
  type: "article";
  locale: Locale;
  category: string;
  articleSlug: string;
  slug: string;
}

interface SubjectParsedPath {
  type: "subject";
  locale: Locale;
  category: string;
  grade: string;
  material: string;
  topic: string;
  section: string;
  slug: string;
}

interface ExerciseParsedPath {
  type: "exercise";
  locale: Locale;
  category: string;
  examType: string;
  material: string;
  exerciseType: string;
  setName: string;
  number: number;
  slug: string;
  isQuestion: boolean;
}

export type {
  ParsedMdx,
  ArticleParsedPath,
  SubjectParsedPath,
  ExerciseParsedPath,
};

export type { Locale } from "@repo/backend/convex/lib/contentValidators";

const METADATA_REGEX = /export\s+const\s+metadata\s*=\s*({[\s\S]*?});/;

const ARTICLE_PATH_REGEX = /articles\/([^/]+)\/([^/]+)\/([^/]+)\.mdx$/;
const SUBJECT_PATH_REGEX =
  /subject\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\.mdx$/;
const EXERCISE_PATH_REGEX =
  /exercises\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/(\d+)\/(_(question|answer))\/([^/]+)\.mdx$/;
const EXERCISE_DIR_REGEX =
  /(.*\/exercises\/[^/]+\/[^/]+\/[^/]+\/[^/]+\/[^/]+\/\d+)\//;

const BACKSLASH_REGEX = /\\/g;
const DEFAULT_EXPORT_REGEX = /export\s+default\s+(\{[\s\S]*\})\s*;?\s*$/;
const CONST_CHOICES_REGEX = /const\s+choices[^=]*=\s*(\{[\s\S]*\})\s*;/;
const REFERENCES_REGEX =
  /export\s+const\s+references[^=]*=\s*(\[[\s\S]*?\]);?\s*$/;
const MULTIPLE_NEWLINES_REGEX = /\n{3,}/g;

/**
 * Normalize whitespace in content.
 * - Replace 3+ consecutive newlines with 2 (proper paragraph spacing)
 * - Trim leading/trailing whitespace
 */
function normalizeWhitespace(content: string): string {
  return content.replace(MULTIPLE_NEWLINES_REGEX, "\n\n").trim();
}

/**
 * Extract metadata and body from MDX file content.
 *
 * Uses the same pattern as packages/contents/_lib/content.ts:
 * - Regex to find `export const metadata = {...};`
 * - Safe eval via `new Function()`
 * - Zod validation with ContentMetadataSchema
 */
export function parseMdxContent(content: string): ParsedMdx {
  const match = content.match(METADATA_REGEX);

  if (!match) {
    throw new Error("No metadata export found in MDX file");
  }

  const metadataStr = match[1];

  const metadataObject = new Function(`return ${metadataStr}`)() as unknown;
  const parseResult = ContentMetadataSchema.safeParse(metadataObject);

  if (!parseResult.success) {
    throw new Error(`Invalid metadata: ${parseResult.error.message}`);
  }

  const body = normalizeWhitespace(content.replace(METADATA_REGEX, ""));
  const contentHash = computeHash(body);

  return {
    metadata: parseResult.data,
    body,
    contentHash,
  };
}

/**
 * Parse MM/DD/YYYY date string to epoch milliseconds.
 */
export function parseDateToEpoch(dateStr: string): number {
  const parts = dateStr.split("/");
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}. Expected MM/DD/YYYY`);
  }

  const [month, day, year] = parts.map(Number);
  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }

  return date.getTime();
}

/**
 * Compute SHA-256 hash of content for change detection.
 */
export function computeHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Parse article path to extract metadata.
 * Path: articles/{category}/{articleSlug}/{locale}.mdx
 */
export function parseArticlePath(filePath: string): ArticleParsedPath {
  const normalized = filePath.replace(BACKSLASH_REGEX, "/");
  const match = normalized.match(ARTICLE_PATH_REGEX);

  if (!match) {
    throw new Error(`Invalid article path: ${filePath}`);
  }

  const [, category, articleSlug, locale] = match;
  const slug = `articles/${category}/${articleSlug}`;

  return {
    type: "article",
    locale: locale as Locale,
    category: category.toLowerCase(),
    articleSlug,
    slug,
  };
}

/**
 * Parse subject path to extract metadata.
 * Path: subject/{category}/{grade}/{material}/{topic}/{section}/{locale}.mdx
 */
export function parseSubjectPath(filePath: string): SubjectParsedPath {
  const normalized = filePath.replace(BACKSLASH_REGEX, "/");
  const match = normalized.match(SUBJECT_PATH_REGEX);

  if (!match) {
    throw new Error(`Invalid subject path: ${filePath}`);
  }

  const [, category, grade, material, topic, section, locale] = match;
  const slug = `subject/${category}/${grade}/${material}/${topic}/${section}`;

  return {
    type: "subject",
    locale: locale as Locale,
    category,
    grade,
    material,
    topic,
    section,
    slug,
  };
}

/**
 * Parse exercise path to extract metadata.
 * Path: exercises/{category}/{type}/{material}/{exerciseType}/{set}/{number}/(_question|_answer)/{locale}.mdx
 */
export function parseExercisePath(filePath: string): ExerciseParsedPath {
  const normalized = filePath.replace(BACKSLASH_REGEX, "/");
  const match = normalized.match(EXERCISE_PATH_REGEX);

  if (!match) {
    throw new Error(`Invalid exercise path: ${filePath}`);
  }

  const [
    ,
    category,
    examType,
    material,
    exerciseType,
    setName,
    numberStr,
    ,
    questionOrAnswer,
    locale,
  ] = match;
  const number = Number.parseInt(numberStr, 10);
  const slug = `exercises/${category}/${examType}/${material}/${exerciseType}/${setName}/${number}`;

  return {
    type: "exercise",
    locale: locale as Locale,
    category,
    examType,
    material,
    exerciseType,
    setName,
    number,
    slug,
    isQuestion: questionOrAnswer === "question",
  };
}

/**
 * Get the directory containing an exercise (for finding choices.ts).
 */
export function getExerciseDir(filePath: string): string {
  const normalized = filePath.replace(BACKSLASH_REGEX, "/");
  const match = normalized.match(EXERCISE_DIR_REGEX);

  if (!match) {
    throw new Error(`Cannot extract exercise directory from: ${filePath}`);
  }

  return match[1];
}

/**
 * Read and parse choices.ts file for an exercise.
 * Uses Zod validation with ExercisesChoicesSchema.
 */
export async function readExerciseChoices(exerciseDir: string): Promise<{
  en: Array<{ label: string; value: boolean }>;
  id: Array<{ label: string; value: boolean }>;
} | null> {
  const choicesPath = path.join(exerciseDir, "choices.ts");

  try {
    const content = await fs.readFile(choicesPath, "utf8");

    const defaultExportMatch = content.match(DEFAULT_EXPORT_REGEX);
    const constExportMatch = content.match(CONST_CHOICES_REGEX);

    const objectMatch = defaultExportMatch || constExportMatch;
    if (!objectMatch) {
      return null;
    }

    const choicesObject = new Function(`return ${objectMatch[1]}`)() as unknown;
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

/**
 * Read and parse an MDX file.
 */
export async function readMdxFile(
  filePath: string
): Promise<ParsedMdx & { filePath: string }> {
  const content = await fs.readFile(filePath, "utf8");
  const parsed = parseMdxContent(content);
  return { ...parsed, filePath };
}

/**
 * Get the directory containing an article (for finding ref.ts).
 * Path: articles/{category}/{articleSlug}/{locale}.mdx -> articles/{category}/{articleSlug}
 */
export function getArticleDir(filePath: string): string {
  return path.dirname(filePath);
}

/**
 * Read and parse ref.ts file for an article.
 * Uses Zod validation with ReferenceSchema.
 */
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

    const referencesArray = new Function(`return ${match[1]}`)() as unknown;

    if (!Array.isArray(referencesArray)) {
      return [];
    }

    const validRefs: Reference[] = [];
    for (const ref of referencesArray) {
      const parseResult = ReferenceSchema.safeParse(ref);
      if (parseResult.success) {
        validRefs.push(parseResult.data);
      } else {
        console.warn(
          `Invalid reference in ${refPath}: ${parseResult.error.message}`
        );
      }
    }

    return validRefs;
  } catch {
    return [];
  }
}
