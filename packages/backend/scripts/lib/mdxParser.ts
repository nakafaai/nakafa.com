import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Locale } from "@repo/backend/convex/lib/contentValidators";
import {
  type ArticleCategory,
  ArticleCategorySchema,
} from "@repo/contents/_types/articles/category";
import {
  type ContentMetadata,
  ContentMetadataSchema,
  type Reference,
  ReferenceSchema,
} from "@repo/contents/_types/content";
import {
  type ExercisesCategory,
  ExercisesCategorySchema,
} from "@repo/contents/_types/exercises/category";
import { ExercisesChoicesSchema } from "@repo/contents/_types/exercises/choices";
import {
  type ExercisesMaterial,
  ExercisesMaterialListSchema,
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
  MaterialListSchema,
  MaterialSchema,
} from "@repo/contents/_types/subject/material";

interface ParsedMdx {
  metadata: ContentMetadata;
  body: string;
  contentHash: string;
}

interface ArticleParsedPath {
  type: "article";
  locale: Locale;
  category: ArticleCategory;
  articleSlug: string;
  slug: string;
}

interface SubjectParsedPath {
  type: "subject";
  locale: Locale;
  category: SubjectCategory;
  grade: Grade;
  material: Material;
  topic: string;
  section: string;
  slug: string;
}

interface ExerciseParsedPath {
  type: "exercise";
  locale: Locale;
  category: ExercisesCategory;
  examType: ExercisesType;
  material: ExercisesMaterial;
  exerciseType: string;
  setName: string;
  number: number;
  slug: string;
  isQuestion: boolean;
}

interface ParsedExerciseSet {
  locale: Locale;
  slug: string;
  category: ExercisesCategory;
  type: ExercisesType;
  material: ExercisesMaterial;
  exerciseType: string;
  setName: string;
  title: string;
  description?: string;
}

interface ParsedSubjectTopic {
  locale: Locale;
  slug: string;
  category: SubjectCategory;
  grade: Grade;
  material: Material;
  topic: string;
  title: string;
  description?: string;
  sectionCount: number;
}

export type {
  ParsedMdx,
  ArticleParsedPath,
  SubjectParsedPath,
  ExerciseParsedPath,
  ParsedExerciseSet,
  ParsedSubjectTopic,
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
 * Validation helpers for parsed path segments.
 * These ensure type-safe parsing and fail fast on invalid paths.
 */
function validateArticleCategory(
  value: string,
  filePath: string
): ArticleCategory {
  const result = ArticleCategorySchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid article category "${value}" in ${filePath}. Expected: politics`
    );
  }
  return result.data;
}

function validateSubjectCategory(
  value: string,
  filePath: string
): SubjectCategory {
  const result = SubjectCategorySchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid subject category "${value}" in ${filePath}. Expected: elementary-school, middle-school, high-school, university`
    );
  }
  return result.data;
}

function validateGrade(value: string, filePath: string): Grade {
  const result = GradeSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid grade "${value}" in ${filePath}. Expected: 1-12, bachelor, master, phd`
    );
  }
  return result.data;
}

function validateMaterial(value: string, filePath: string): Material {
  const result = MaterialSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid material "${value}" in ${filePath}. Check MaterialSchema for valid values.`
    );
  }
  return result.data;
}

function validateExercisesCategory(
  value: string,
  filePath: string
): ExercisesCategory {
  const result = ExercisesCategorySchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid exercises category "${value}" in ${filePath}. Expected: high-school, middle-school`
    );
  }
  return result.data;
}

function validateExercisesType(value: string, filePath: string): ExercisesType {
  const result = ExercisesTypeSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid exercises type "${value}" in ${filePath}. Expected: grade-9, tka, snbt`
    );
  }
  return result.data;
}

function validateExercisesMaterial(
  value: string,
  filePath: string
): ExercisesMaterial {
  const result = ExercisesMaterialSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid exercises material "${value}" in ${filePath}. Check ExercisesMaterialSchema for valid values.`
    );
  }
  return result.data;
}

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

  const [, rawCategory, articleSlug, locale] = match;
  const category = validateArticleCategory(rawCategory.toLowerCase(), filePath);
  const slug = `articles/${category}/${articleSlug}`;

  return {
    type: "article",
    locale: locale as Locale,
    category,
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

  const [, rawCategory, rawGrade, rawMaterial, topic, section, locale] = match;
  const category = validateSubjectCategory(rawCategory, filePath);
  const grade = validateGrade(rawGrade, filePath);
  const material = validateMaterial(rawMaterial, filePath);
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
    rawCategory,
    rawExamType,
    rawMaterial,
    exerciseType,
    setName,
    numberStr,
    ,
    questionOrAnswer,
    locale,
  ] = match;
  const category = validateExercisesCategory(rawCategory, filePath);
  const examType = validateExercisesType(rawExamType, filePath);
  const material = validateExercisesMaterial(rawMaterial, filePath);
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

const BASE_PATH_REGEX = /export\s+const\s+BASE_PATH\s*=\s*["']([^"']+)["']/;
const LEADING_SLASH_REGEX = /^\//;
const LAST_PATH_SEGMENT_REGEX = /\/([^/]+)$/;
const BASE_PATH_TEMPLATE_REGEX = /\$\{BASE_PATH\}/g;

const EXERCISE_MATERIAL_PATH_REGEX =
  /exercises\/([^/]+)\/([^/]+)\/([^/]+)\/_data/;
const EXERCISE_MATERIAL_CONST_REGEX =
  /const\s+\w+Materials[^=]*=\s*(\[[\s\S]*?\])\s*as\s+const/;

/**
 * Parse a material file to extract exercise set information.
 * Returns all sets defined in the material file.
 */
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
  const validCategory = validateExercisesCategory(
    rawCategory,
    materialFilePath
  );
  const validType = validateExercisesType(rawType, materialFilePath);
  const validMaterial = validateExercisesMaterial(
    rawMaterial,
    materialFilePath
  );

  const indexPath = path.join(path.dirname(materialFilePath), "index.ts");
  let basePath = `exercises/${validCategory}/${validType}/${validMaterial}`;

  try {
    const indexContent = await fs.readFile(indexPath, "utf8");
    const basePathMatch = indexContent.match(BASE_PATH_REGEX);
    if (basePathMatch) {
      basePath = basePathMatch[1].replace(LEADING_SLASH_REGEX, "");
    }
  } catch {
    // Use default basePath
  }

  const content = await fs.readFile(materialFilePath, "utf8");
  const constMatch = content.match(EXERCISE_MATERIAL_CONST_REGEX);

  if (!constMatch) {
    return [];
  }

  const arrayWithBasePath = constMatch[1].replace(
    BASE_PATH_TEMPLATE_REGEX,
    `/${basePath}`
  );

  const materialsArray = new Function(
    `return ${arrayWithBasePath}`
  )() as unknown;
  const parseResult = ExercisesMaterialListSchema.safeParse(materialsArray);

  if (!parseResult.success) {
    console.warn(
      `Invalid material file ${materialFilePath}: ${parseResult.error.message}`
    );
    return [];
  }

  const sets: ParsedExerciseSet[] = [];

  for (const exerciseTypeGroup of parseResult.data) {
    const exerciseTypeMatch = exerciseTypeGroup.href.match(
      LAST_PATH_SEGMENT_REGEX
    );
    const exerciseType = exerciseTypeMatch ? exerciseTypeMatch[1] : "";

    for (const setItem of exerciseTypeGroup.items) {
      const setNameMatch = setItem.href.match(LAST_PATH_SEGMENT_REGEX);
      const setName = setNameMatch ? setNameMatch[1] : "";
      const slug = `${basePath}/${exerciseType}/${setName}`;

      sets.push({
        locale,
        slug,
        category: validCategory,
        type: validType,
        material: validMaterial,
        exerciseType,
        setName,
        title: setItem.title,
        description: exerciseTypeGroup.description,
      });
    }
  }

  return sets;
}

const SUBJECT_MATERIAL_PATH_REGEX = /subject\/([^/]+)\/([^/]+)\/([^/]+)\/_data/;
const SUBJECT_MATERIAL_CONST_REGEX =
  /const\s+\w+Materials[^=]*=\s*(\[[\s\S]*\])(?:\s*as\s+const)?;\s*export\s+default/;

/**
 * Parse a subject material file to extract topic information.
 * Returns all topics defined in the material file.
 * Path: subject/{category}/{grade}/{material}/_data/{locale}-material.ts
 */
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
  const validCategory = validateSubjectCategory(rawCategory, materialFilePath);
  const validGrade = validateGrade(rawGrade, materialFilePath);
  const validMaterial = validateMaterial(rawMaterial, materialFilePath);

  const indexPath = path.join(path.dirname(materialFilePath), "index.ts");
  let basePath = `subject/${validCategory}/${validGrade}/${validMaterial}`;

  try {
    const indexContent = await fs.readFile(indexPath, "utf8");
    const basePathMatch = indexContent.match(BASE_PATH_REGEX);
    if (basePathMatch) {
      basePath = basePathMatch[1].replace(LEADING_SLASH_REGEX, "");
    }
  } catch {
    // Use default basePath
  }

  const content = await fs.readFile(materialFilePath, "utf8");
  const constMatch = content.match(SUBJECT_MATERIAL_CONST_REGEX);

  if (!constMatch) {
    return [];
  }

  const arrayWithBasePath = constMatch[1].replace(
    BASE_PATH_TEMPLATE_REGEX,
    `/${basePath}`
  );

  const materialsArray = new Function(
    `return ${arrayWithBasePath}`
  )() as unknown;
  const parseResult = MaterialListSchema.safeParse(materialsArray);

  if (!parseResult.success) {
    console.warn(
      `Invalid subject material file ${materialFilePath}: ${parseResult.error.message}`
    );
    return [];
  }

  const topics: ParsedSubjectTopic[] = [];

  for (const topicGroup of parseResult.data) {
    const topicMatch = topicGroup.href.match(LAST_PATH_SEGMENT_REGEX);
    const topic = topicMatch ? topicMatch[1] : "";
    const slug = `${basePath}/${topic}`;

    topics.push({
      locale,
      slug,
      category: validCategory,
      grade: validGrade,
      material: validMaterial,
      topic,
      title: topicGroup.title,
      description: topicGroup.description,
      sectionCount: topicGroup.items.length,
    });
  }

  return topics;
}
