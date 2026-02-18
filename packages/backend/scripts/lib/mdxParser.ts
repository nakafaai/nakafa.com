import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
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
import * as z from "zod";

/** Parsed MDX file with extracted metadata and content hash for change detection */
interface ParsedMdx {
  body: string;
  contentHash: string;
  metadata: ContentMetadata;
}

/** Parsed path info for article files: articles/{category}/{articleSlug}/{locale}.mdx */
interface ArticleParsedPath {
  articleSlug: string;
  category: ArticleCategory;
  locale: Locale;
  /** Full slug: articles/{category}/{articleSlug} */
  slug: string;
  type: "article";
}

/** Parsed path info for subject files: subject/{category}/{grade}/{material}/{topic}/{section}/{locale}.mdx */
interface SubjectParsedPath {
  category: SubjectCategory;
  grade: Grade;
  locale: Locale;
  material: Material;
  section: string;
  /** Full slug: subject/{category}/{grade}/{material}/{topic}/{section} */
  slug: string;
  topic: string;
  type: "subject";
}

/** Parsed path info for exercise files: exercises/{category}/{type}/{material}/{exerciseType}/{set}/{number}/(_question|_answer)/{locale}.mdx */
interface ExerciseParsedPath {
  category: ExercisesCategory;
  examType: ExercisesType;
  exerciseType: string;
  isQuestion: boolean;
  locale: Locale;
  material: ExercisesMaterial;
  number: number;
  setName: string;
  /** Full slug: exercises/{category}/{type}/{material}/{exerciseType}/{set}/{number} */
  slug: string;
  type: "exercise";
}

/** Parsed exercise set from material file */
interface ParsedExerciseSet {
  category: ExercisesCategory;
  description?: string;
  exerciseType: string;
  locale: Locale;
  material: ExercisesMaterial;
  setName: string;
  slug: string;
  title: string;
  type: ExercisesType;
}

/** Parsed subject topic from material file */
interface ParsedSubjectTopic {
  category: SubjectCategory;
  description?: string;
  grade: Grade;
  locale: Locale;
  material: Material;
  sectionCount: number;
  slug: string;
  title: string;
  topic: string;
}

export type {
  ParsedMdx,
  ArticleParsedPath,
  SubjectParsedPath,
  ExerciseParsedPath,
  ParsedExerciseSet,
  ParsedSubjectTopic,
};

export type { Locale } from "@repo/backend/convex/lib/validators/contents";

// Regex patterns for parsing MDX content and file paths
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

/** Zod schema for validating locale from file paths */
const LocaleSchema = z.union([z.literal("en"), z.literal("id")]);

/**
 * Validates locale from path segment.
 * @throws Error if locale is invalid
 */
function validateLocale(value: string, filePath: string): Locale {
  const result = LocaleSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid locale "${value}" in ${filePath}. Expected: en, id`
    );
  }
  return result.data;
}

/**
 * Validates article category from path segment.
 * @throws Error if category is invalid
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

/**
 * Validates subject category from path segment.
 * @throws Error if category is invalid
 */
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

/**
 * Validates grade from path segment.
 * @throws Error if grade is invalid
 */
function validateGrade(value: string, filePath: string): Grade {
  const result = GradeSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid grade "${value}" in ${filePath}. Expected: 1-12, bachelor, master, phd`
    );
  }
  return result.data;
}

/**
 * Validates material from path segment.
 * @throws Error if material is invalid
 */
function validateMaterial(value: string, filePath: string): Material {
  const result = MaterialSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid material "${value}" in ${filePath}. Check MaterialSchema for valid values.`
    );
  }
  return result.data;
}

/**
 * Validates exercises category from path segment.
 * @throws Error if category is invalid
 */
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

/**
 * Validates exercises type from path segment.
 * @throws Error if type is invalid
 */
function validateExercisesType(value: string, filePath: string): ExercisesType {
  const result = ExercisesTypeSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid exercises type "${value}" in ${filePath}. Expected: grade-9, tka, snbt`
    );
  }
  return result.data;
}

/**
 * Validates exercises material from path segment.
 * @throws Error if material is invalid
 */
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
 * Normalizes whitespace in content by collapsing 3+ newlines to 2.
 * @returns Trimmed content with proper paragraph spacing
 */
function normalizeWhitespace(content: string): string {
  return content.replace(MULTIPLE_NEWLINES_REGEX, "\n\n").trim();
}

/**
 * Extracts metadata and body from MDX file content.
 *
 * Parses `export const metadata = {...}` using the same approach as
 * packages/contents/_lib/content.ts for consistency.
 *
 * @param content - Raw MDX file content
 * @returns Parsed metadata, body, and content hash
 * @throws Error if metadata export is missing or invalid
 *
 * @example
 * const { metadata, body, contentHash } = parseMdxContent(fileContent);
 * console.log(metadata.title); // "My Article"
 */
export function parseMdxContent(content: string): ParsedMdx {
  const match = content.match(METADATA_REGEX);

  if (!match) {
    throw new Error("No metadata export found in MDX file");
  }

  const metadataStr = match[1];

  // Safe eval via Function constructor (same as packages/contents/_lib/content.ts)
  const metadataObject = new Function(`return ${metadataStr}`)();
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
 * Parses MM/DD/YYYY date string to epoch milliseconds.
 *
 * @param dateStr - Date in MM/DD/YYYY format
 * @returns Unix timestamp in milliseconds
 * @throws Error if date format is invalid
 *
 * @example
 * parseDateToEpoch("01/15/2024"); // Returns 1705276800000
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
 * Computes SHA-256 hash for change detection.
 *
 * @param content - Content to hash
 * @returns Hex-encoded SHA-256 hash
 */
export function computeHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Parses article file path to extract metadata.
 *
 * @param filePath - Path like: articles/{category}/{articleSlug}/{locale}.mdx
 * @returns Parsed path info with category, slug, and locale
 * @throws Error if path doesn't match expected pattern
 *
 * @example
 * const info = parseArticlePath("articles/politics/climate-change/en.mdx");
 * // { type: "article", locale: "en", category: "politics", articleSlug: "climate-change", slug: "articles/politics/climate-change" }
 */
export function parseArticlePath(filePath: string): ArticleParsedPath {
  const normalized = filePath.replace(BACKSLASH_REGEX, "/");
  const match = normalized.match(ARTICLE_PATH_REGEX);

  if (!match) {
    throw new Error(`Invalid article path: ${filePath}`);
  }

  const [, rawCategory, articleSlug, rawLocale] = match;
  const category = validateArticleCategory(rawCategory.toLowerCase(), filePath);
  const locale = validateLocale(rawLocale, filePath);
  const slug = `articles/${category}/${articleSlug}`;

  return {
    type: "article",
    locale,
    category,
    articleSlug,
    slug,
  };
}

/**
 * Parses subject file path to extract metadata.
 *
 * @param filePath - Path like: subject/{category}/{grade}/{material}/{topic}/{section}/{locale}.mdx
 * @returns Parsed path info with all path segments
 * @throws Error if path doesn't match expected pattern
 *
 * @example
 * const info = parseSubjectPath("subject/high-school/10/mathematics/algebra/linear-equations/en.mdx");
 */
export function parseSubjectPath(filePath: string): SubjectParsedPath {
  const normalized = filePath.replace(BACKSLASH_REGEX, "/");
  const match = normalized.match(SUBJECT_PATH_REGEX);

  if (!match) {
    throw new Error(`Invalid subject path: ${filePath}`);
  }

  const [, rawCategory, rawGrade, rawMaterial, topic, section, rawLocale] =
    match;
  const category = validateSubjectCategory(rawCategory, filePath);
  const grade = validateGrade(rawGrade, filePath);
  const material = validateMaterial(rawMaterial, filePath);
  const locale = validateLocale(rawLocale, filePath);
  const slug = `subject/${category}/${grade}/${material}/${topic}/${section}`;

  return {
    type: "subject",
    locale,
    category,
    grade,
    material,
    topic,
    section,
    slug,
  };
}

/**
 * Parses exercise file path to extract metadata.
 *
 * @param filePath - Path like: exercises/{category}/{type}/{material}/{exerciseType}/{set}/{number}/(_question|_answer)/{locale}.mdx
 * @returns Parsed path info with all path segments and isQuestion flag
 * @throws Error if path doesn't match expected pattern
 *
 * @example
 * const info = parseExercisePath("exercises/high-school/snbt/mathematics/multiple-choice/set-1/1/_question/en.mdx");
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
    rawLocale,
  ] = match;
  const category = validateExercisesCategory(rawCategory, filePath);
  const examType = validateExercisesType(rawExamType, filePath);
  const material = validateExercisesMaterial(rawMaterial, filePath);
  const locale = validateLocale(rawLocale, filePath);
  const number = Number.parseInt(numberStr, 10);
  const slug = `exercises/${category}/${examType}/${material}/${exerciseType}/${setName}/${number}`;

  return {
    type: "exercise",
    locale,
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
 * Extracts the exercise directory from a question/answer file path.
 * Used to locate the choices.ts file.
 *
 * @param filePath - Full path to question or answer MDX file
 * @returns Directory containing the exercise (one level above _question/_answer)
 * @throws Error if path doesn't match expected pattern
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
 * Reads and parses choices.ts for an exercise question.
 *
 * @param exerciseDir - Directory containing choices.ts
 * @returns Parsed choices per locale, or null if file doesn't exist
 *
 * @example
 * const choices = await readExerciseChoices("/path/to/exercise/1");
 * if (choices) {
 *   console.log(choices.en); // [{ label: "Option A", value: true }, ...]
 * }
 */
export async function readExerciseChoices(exerciseDir: string): Promise<{
  en: Array<{ label: string; value: boolean }>;
  id: Array<{ label: string; value: boolean }>;
} | null> {
  const choicesPath = path.join(exerciseDir, "choices.ts");

  try {
    const content = await fs.readFile(choicesPath, "utf8");

    // Support both `export default {...}` and `const choices = {...}`
    const defaultExportMatch = content.match(DEFAULT_EXPORT_REGEX);
    const constExportMatch = content.match(CONST_CHOICES_REGEX);

    const objectMatch = defaultExportMatch || constExportMatch;
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

/**
 * Reads and parses an MDX file.
 *
 * @param filePath - Path to MDX file
 * @returns Parsed content with metadata, body, hash, and original path
 */
export async function readMdxFile(
  filePath: string
): Promise<ParsedMdx & { filePath: string }> {
  const content = await fs.readFile(filePath, "utf8");
  const parsed = parseMdxContent(content);
  return { ...parsed, filePath };
}

/**
 * Gets the directory containing an article (for finding ref.ts).
 *
 * @param filePath - Path like: articles/{category}/{slug}/{locale}.mdx
 * @returns Parent directory: articles/{category}/{slug}
 */
export function getArticleDir(filePath: string): string {
  return path.dirname(filePath);
}

/**
 * Reads and parses ref.ts references for an article.
 *
 * @param articleDir - Directory containing ref.ts
 * @returns Array of validated references, empty if file missing or invalid
 *
 * @example
 * const refs = await readArticleReferences("/path/to/articles/politics/my-article");
 * // [{ title: "Study", authors: "Smith et al.", year: 2024, url: "..." }]
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

    const referencesArray = new Function(`return ${match[1]}`)();

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

// Regex for material file parsing
const BASE_PATH_REGEX = /export\s+const\s+BASE_PATH\s*=\s*["']([^"']+)["']/;
const LEADING_SLASH_REGEX = /^\//;
const LAST_PATH_SEGMENT_REGEX = /\/([^/]+)$/;
const BASE_PATH_TEMPLATE_REGEX = /\$\{BASE_PATH\}/g;

const EXERCISE_MATERIAL_PATH_REGEX =
  /exercises\/([^/]+)\/([^/]+)\/([^/]+)\/_data/;
const EXERCISE_MATERIAL_CONST_REGEX =
  /const\s+\w+Materials[^=]*=\s*(\[[\s\S]*?\])\s*as\s+const/;

/**
 * Parses exercise material file to extract set information.
 *
 * Material files define exercise sets with their titles and descriptions.
 * Located at: exercises/{category}/{type}/{material}/_data/{locale}-material.ts
 *
 * @param materialFilePath - Path to material file
 * @param locale - Locale for the material (en/id)
 * @returns Array of exercise sets defined in the file
 * @throws Error if path doesn't match expected pattern
 *
 * @example
 * const sets = await parseExerciseMaterialFile(
 *   "exercises/high-school/snbt/mathematics/_data/en-material.ts",
 *   "en"
 * );
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

  // Try to read BASE_PATH from index.ts, fallback to constructed path
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

  // Replace ${BASE_PATH} template with actual path
  const arrayWithBasePath = constMatch[1].replace(
    BASE_PATH_TEMPLATE_REGEX,
    `/${basePath}`
  );

  const materialsArray = new Function(`return ${arrayWithBasePath}`)();
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
 * Parses subject material file to extract topic information.
 *
 * Material files define topics with their titles, descriptions, and section counts.
 * Located at: subject/{category}/{grade}/{material}/_data/{locale}-material.ts
 *
 * @param materialFilePath - Path to material file
 * @param locale - Locale for the material (en/id)
 * @returns Array of topics defined in the file
 * @throws Error if path doesn't match expected pattern
 *
 * @example
 * const topics = await parseSubjectMaterialFile(
 *   "subject/high-school/10/mathematics/_data/en-material.ts",
 *   "en"
 * );
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

  // Try to read BASE_PATH from index.ts, fallback to constructed path
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

  // Replace ${BASE_PATH} template with actual path
  const arrayWithBasePath = constMatch[1].replace(
    BASE_PATH_TEMPLATE_REGEX,
    `/${basePath}`
  );

  const materialsArray = new Function(`return ${arrayWithBasePath}`)();
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
