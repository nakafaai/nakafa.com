import fs, { promises as fsPromises } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ContentMetadata } from "@repo/contents/_types/content";
import {
  ContentMetadataSchema,
  ContentSchema,
  type Reference,
} from "@repo/contents/_types/content";
import ky from "ky";
import type { Locale } from "next-intl";
import { createElement } from "react";
import {
  type ExercisesChoices,
  ExercisesChoicesSchema,
} from "../_types/exercises/choices";

// Get the directory where this file is located and resolve to contents directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contentsDir = path.resolve(__dirname, "..");

/**
 * Reads the raw content of a file from the contents directory.
 * @param filePath - The path to the file relative to the contents directory.
 * @returns The raw content of the file.
 */
export async function getRawContent(filePath: string): Promise<string> {
  // Strip leading slash if present for consistency
  const cleanPath = filePath.startsWith("/") ? filePath.substring(1) : filePath;

  // Resolve path relative to the contents directory
  const fullPath = path.resolve(contentsDir, cleanPath);

  // Check if file exists locally
  const exists = await fsPromises
    .access(fullPath, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);

  if (exists) {
    // Read local file, return empty string if it fails
    return await fsPromises.readFile(fullPath, "utf8").catch(() => "");
  }

  // Fallback to fetching from GitHub, return empty string if it fails
  return await ky
    .get(
      `https://raw.githubusercontent.com/nakafaai/nakafa.com/refs/heads/main/packages/contents/${cleanPath}`,
      {
        cache: "force-cache",
      }
    )
    .text()
    .catch(() => "");
}

/**
 * Gets the content for a specific file path.
 * This approach uses dynamic imports with relative paths.
 * @param path - The path to the content file.
 * @returns The content metadata and component.
 */
export async function getContent(
  locale: Locale,
  filePath: string
): Promise<{
  metadata: ContentMetadata;
  default: ReturnType<typeof createElement>;
  raw: string;
} | null> {
  try {
    // Strip leading slash if present for consistency
    const cleanPath = filePath.startsWith("/")
      ? filePath.substring(1)
      : filePath;

    const contentPath = `${cleanPath}/${locale}.mdx`;

    // Create a dynamic import path that works reliably with Next.js
    // Using a relative path from the location of this file (lib/utils)
    const [contentModule, raw] = await Promise.all([
      import(`@repo/contents/${contentPath}`),
      getRawContent(contentPath),
    ]);

    const parsedMetadata = ContentMetadataSchema.parse(contentModule.metadata);

    return {
      metadata: parsedMetadata,
      default: createElement(contentModule.default),
      raw,
    };
  } catch {
    return null;
  }
}

export async function getContents({
  locale = "en",
  basePath = "",
}: {
  locale?: Locale;
  basePath?: string;
}) {
  const result: { slug: string[] }[] = [];

  const nestedPaths = getNestedSlugs(basePath);

  result.push({ slug: [basePath] });

  for (const nestedPath of nestedPaths) {
    result.push({ slug: [basePath, ...nestedPath] });
  }

  const promises = result.map(async (item) => {
    const content = await getContent(locale, item.slug.join("/"));
    if (!content) {
      return null;
    }

    const url = new URL(
      `/${locale}/${item.slug.join("/")}`,
      "https://nakafa.com"
    );

    const { data, error } = ContentSchema.safeParse({
      metadata: content.metadata,
      raw: content.raw,
      url: url.toString(),
      slug: item.slug.join("/"),
      locale,
    });

    if (error) {
      return null;
    }

    return data;
  });

  const contents = await Promise.all(promises).then((results) =>
    results.filter((item) => item !== null)
  );

  return contents;
}

/**
 * Gets the exercises content for a specific file path.
 * @param locale - The locale to get the exercises content for.
 * @param filePath - The path to the exercises content file.
 * @returns The exercises content.
 */
export async function getExercisesContent(
  locale: Locale,
  filePath: string
): Promise<
  | {
      number: number;
      choices: ExercisesChoices;
      question: {
        default: ReturnType<typeof createElement>;
        raw: string;
      };
      answer: {
        default: ReturnType<typeof createElement>;
        raw: string;
      };
    }[]
  | null
> {
  try {
    // Strip leading slash if present for consistency
    const cleanPath = filePath.startsWith("/")
      ? filePath.substring(1)
      : filePath;

    // Get all numbered folders (exercise questions)
    const questionNumbers = getFolderChildNames(cleanPath);

    if (questionNumbers.length === 0) {
      return null;
    }

    // Load all exercises in parallel
    const exercisesPromises = questionNumbers.map(async (numberStr) => {
      // Validate that the folder name is a valid number
      const number = Number.parseInt(numberStr, 10);
      if (Number.isNaN(number)) {
        return null;
      }

      // Construct paths for question, answer, and choices
      const questionPath = `${cleanPath}/${numberStr}/_question`;
      const answerPath = `${cleanPath}/${numberStr}/_answer`;
      const choicesPath = `${cleanPath}/${numberStr}/choices.ts`;

      // Load question, answer, and choices in parallel
      const [questionContent, answerContent, choicesModule] = await Promise.all(
        [
          getContent(locale, questionPath),
          getContent(locale, answerPath),
          import(`@repo/contents/${choicesPath}`).catch(() => null),
        ]
      );

      // Validate all required content is present
      const hasAllContent =
        questionContent && answerContent && choicesModule?.default;

      if (!hasAllContent) {
        return null;
      }

      // Parse choices with schema validation
      const parsedChoices = ExercisesChoicesSchema.safeParse(
        choicesModule.default
      );

      if (!parsedChoices.success) {
        return null;
      }

      return {
        number,
        choices: parsedChoices.data,
        question: {
          default: questionContent.default,
          raw: questionContent.raw,
        },
        answer: {
          default: answerContent.default,
          raw: answerContent.raw,
        },
      };
    });

    const exercises = await Promise.all(exercisesPromises);

    // Filter out any failed loads and sort by number
    const validExercises = exercises
      .filter((exercise) => exercise !== null)
      .sort((a, b) => a.number - b.number);

    if (validExercises.length === 0) {
      return null;
    }

    return validExercises;
  } catch {
    return null;
  }
}

/**
 * Gets the references from the references.ts file.
 * @param path - The path to the references file.
 * @returns The references.
 */
export async function getReferences(filePath: string): Promise<Reference[]> {
  try {
    // Strip leading slash if present for consistency
    const cleanPath = filePath.startsWith("/")
      ? filePath.substring(1)
      : filePath;

    // Create a dynamic import path that works reliably with Next.js
    // Using a relative path from the location of this file (lib/utils)
    const refModule = await import(`@repo/contents/${cleanPath}/ref.ts`);

    return refModule.references || [];
  } catch {
    return [];
  }
}

/**
 * Gets the child names of the folder.
 * @param folder - The folder to get the child names for.
 * @param exclude - The names to exclude from the child names. can be the prefix of the folder or the folder name itself
 * @returns The child names of the folder.
 */
export function getFolderChildNames(folder: string, exclude?: string[]) {
  const defaultExclude = ["_", "node_modules", ".", "dist"];

  const effectiveExclude = [...defaultExclude, ...(exclude ?? [])];

  try {
    // Resolve path relative to the contents directory
    const contentDir = path.resolve(contentsDir, folder);

    // Check if directory exists first
    if (!fs.existsSync(contentDir)) {
      return [];
    }

    // Read directory synchronously - required for Next.js static generation
    const files = fs.readdirSync(contentDir, { withFileTypes: true });

    // Filter directories and return their names
    const dirs = files.filter((dirent) => dirent.isDirectory());
    let dirNames = dirs.map((dirent) => dirent.name);

    // Filter out excluded directories if exclude parameter is provided
    if (effectiveExclude.length > 0) {
      dirNames = dirNames.filter(
        (name) =>
          !effectiveExclude.some(
            (excludeItem) =>
              name === excludeItem || name.startsWith(excludeItem)
          )
      );
    }

    return dirNames;
  } catch {
    return [];
  }
}

/**
 * Recursively builds slug arrays from nested folder structure
 * @param basePath - Base path to start folder traversal
 * @param currentPath - Current path traversed (used internally for recursion)
 * @param result - Current result array (used internally for recursion)
 * @returns Array of string arrays representing possible slug paths
 */
export function getNestedSlugs(
  basePath: string,
  currentPath: string[] = [],
  result: string[][] = []
): string[][] {
  let cleanBasePath = basePath;
  // if basePath empty string, use "."
  if (basePath === "") {
    cleanBasePath = ".";
  }

  const fullPath =
    currentPath.length === 0
      ? cleanBasePath
      : `${cleanBasePath}/${currentPath.join("/")}`;

  const children = getFolderChildNames(fullPath);

  if (children.length === 0) {
    // Add leaf nodes as valid slug paths
    if (currentPath.length > 0) {
      result.push([...currentPath]);
    }
    return result;
  }

  // Check if there are any files at this level
  if (currentPath.length > 0) {
    result.push([...currentPath]);
  }

  // Recursive case: explore children
  for (const child of children) {
    getNestedSlugs(basePath, [...currentPath, child], result);
  }

  return result;
}
