import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

type Locale = "en" | "id";

interface ParsedMetadata {
  title: string;
  description?: string;
  authors: Array<{ name: string }>;
  date: string;
  subject?: string;
  category?: string;
}

interface ParsedMdx {
  metadata: ParsedMetadata;
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
  Locale,
  ParsedMetadata,
  ParsedMdx,
  ArticleParsedPath,
  SubjectParsedPath,
  ExerciseParsedPath,
};

const METADATA_EXPORT_REGEX =
  /export\s+const\s+metadata\s*=\s*(\{[\s\S]*?\n\});?\s*\n/;
const TITLE_REGEX = /title:\s*["'`]([^"'`]+)["'`]/;
const DESCRIPTION_REGEX = /description:\s*["'`]([^"'`]+)["'`]/;
const DATE_REGEX = /date:\s*["'`]([^"'`]+)["'`]/;
const SUBJECT_REGEX = /subject:\s*["'`]([^"'`]+)["'`]/;
const CATEGORY_REGEX = /category:\s*["'`]([^"'`]+)["'`]/;
const AUTHORS_ARRAY_REGEX = /authors:\s*\[([\s\S]*?)\]/;
const AUTHOR_NAME_REGEX = /name:\s*["'`]([^"'`]+)["'`]/g;

const ARTICLE_PATH_REGEX = /articles\/([^/]+)\/([^/]+)\/([^/]+)\.mdx$/;
const SUBJECT_PATH_REGEX =
  /subject\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\.mdx$/;
const EXERCISE_PATH_REGEX =
  /exercises\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/(\d+)\/(_(question|answer))\/([^/]+)\.mdx$/;
const EXERCISE_DIR_REGEX =
  /(.*\/exercises\/[^/]+\/[^/]+\/[^/]+\/[^/]+\/[^/]+\/\d+)\//;

const CHOICE_ITEM_REGEX =
  /\{\s*label:\s*["'`]([^"'`]+)["'`],\s*value:\s*(true|false)\s*,?\s*\}/g;
const BACKSLASH_REGEX = /\\/g;

/**
 * Extract metadata export and body from MDX file content.
 *
 * MDX files export metadata as:
 * ```
 * export const metadata = { ... };
 * ```
 *
 * We need to parse this without executing the code.
 */
export function parseMdxContent(content: string): ParsedMdx {
  const match = content.match(METADATA_EXPORT_REGEX);

  if (!match) {
    throw new Error("No metadata export found in MDX file");
  }

  const metadataStr = match[1];
  const metadataStartIndex = match.index ?? 0;
  const metadataEndIndex = metadataStartIndex + match[0].length;

  const metadata = parseMetadataObject(metadataStr);
  const beforeMetadata = content.slice(0, metadataStartIndex);
  const afterMetadata = content.slice(metadataEndIndex);
  const body = (beforeMetadata + afterMetadata).trim();
  const contentHash = computeHash(body);

  return { metadata, body, contentHash };
}

/**
 * Parse metadata object string into typed object.
 * Uses a simplified parser that handles common patterns.
 */
function parseMetadataObject(str: string): ParsedMetadata {
  const result: Partial<ParsedMetadata> = {};

  const titleMatch = str.match(TITLE_REGEX);
  if (titleMatch) {
    result.title = titleMatch[1];
  }

  const descMatch = str.match(DESCRIPTION_REGEX);
  if (descMatch) {
    result.description = descMatch[1];
  }

  const dateMatch = str.match(DATE_REGEX);
  if (dateMatch) {
    result.date = dateMatch[1];
  }

  const subjectMatch = str.match(SUBJECT_REGEX);
  if (subjectMatch) {
    result.subject = subjectMatch[1];
  }

  const categoryMatch = str.match(CATEGORY_REGEX);
  if (categoryMatch) {
    result.category = categoryMatch[1];
  }

  const authorsMatch = str.match(AUTHORS_ARRAY_REGEX);
  if (authorsMatch) {
    const authorsContent = authorsMatch[1];
    const authorNames: Array<{ name: string }> = [];
    const authorMatches = authorsContent.matchAll(AUTHOR_NAME_REGEX);
    for (const match of authorMatches) {
      authorNames.push({ name: match[1] });
    }
    result.authors = authorNames;
  }

  if (!result.title) {
    throw new Error("Missing required field: title");
  }

  if (!result.date) {
    throw new Error("Missing required field: date");
  }

  return {
    title: result.title,
    description: result.description,
    authors: result.authors ?? [],
    date: result.date,
    subject: result.subject,
    category: result.category,
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
 * Compute SHA-256 hash of content.
 */
export function computeHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Parse article path to extract metadata.
 * Path: packages/contents/articles/{category}/{articleSlug}/{locale}.mdx
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
 * Path: packages/contents/subject/{category}/{grade}/{material}/{topic}/{section}/{locale}.mdx
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
 * Path: packages/contents/exercises/{category}/{type}/{material}/{exerciseType}/{set}/{number}/(_question|_answer)/{locale}.mdx
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
 */
export async function readExerciseChoices(exerciseDir: string): Promise<{
  en: Array<{ label: string; value: boolean }>;
  id: Array<{ label: string; value: boolean }>;
} | null> {
  const choicesPath = path.join(exerciseDir, "choices.ts");

  try {
    const content = await fs.readFile(choicesPath, "utf8");
    return parseChoicesFile(content);
  } catch {
    return null;
  }
}

/**
 * Create locale-specific regex for matching choice arrays.
 */
function createLocaleChoicesRegex(locale: string): RegExp {
  return new RegExp(`${locale}:\\s*\\[([\\s\\S]*?)\\]`, "g");
}

/**
 * Parse choices.ts file content without executing it.
 */
function parseChoicesFile(content: string): {
  en: Array<{ label: string; value: boolean }>;
  id: Array<{ label: string; value: boolean }>;
} {
  const result: {
    en: Array<{ label: string; value: boolean }>;
    id: Array<{ label: string; value: boolean }>;
  } = {
    en: [],
    id: [],
  };

  for (const locale of ["en", "id"] as const) {
    const localeRegex = createLocaleChoicesRegex(locale);
    const localeMatch = content.match(localeRegex);

    if (localeMatch?.[0]) {
      const choicesContent = localeMatch[0];
      const choiceMatches = choicesContent.matchAll(CHOICE_ITEM_REGEX);

      for (const match of choiceMatches) {
        result[locale].push({
          label: match[1],
          value: match[2] === "true",
        });
      }
    }
  }

  return result;
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
