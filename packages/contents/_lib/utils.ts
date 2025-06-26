import fs, { promises as fsPromises } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ContentMetadata } from "@repo/contents/_types/content";
import {
  ContentMetadataSchema,
  type Reference,
} from "@repo/contents/_types/content";
import { env } from "@repo/contents/env";
import type { Locale } from "next-intl";
import type { ComponentType } from "react";

// Get the directory where this file is located and resolve to contents directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolves the absolute path to the contents directory.
 * Uses process.cwd() for production, preview, and development environments for compatibility.
 */
const contentsDir =
  env.VERCEL_ENV &&
  ["production", "preview", "development"].includes(env.VERCEL_ENV)
    ? path.join(process.cwd(), "packages/contents")
    : path.resolve(__dirname, "..");

/**
 * Debug function to understand the file system structure in different environments
 */
export function debugFileSystem() {
  const debug = {
    nodeEnv: process.env.NODE_ENV,
    cwd: process.cwd(),
    __dirname,
    __filename,
    contentsDir,
    contentsDirExists: fs.existsSync(contentsDir),
    cwdContents: [] as string[],
    contentsDirContents: [] as string[],
  };

  try {
    debug.cwdContents = fs.readdirSync(process.cwd());
  } catch {
    debug.cwdContents = ["Error reading cwd"];
  }

  try {
    if (fs.existsSync(contentsDir)) {
      debug.contentsDirContents = fs.readdirSync(contentsDir);
    }
  } catch {
    debug.contentsDirContents = ["Error reading contents dir"];
  }

  return debug;
}

/**
 * Reads the raw content of a file from the contents directory.
 * @param filePath - The path to the file relative to the contents directory.
 * @returns The raw content of the file.
 */
export async function getRawContent(filePath: string): Promise<string> {
  try {
    // Strip leading slash if present for consistency
    const cleanPath = filePath.startsWith("/")
      ? filePath.substring(1)
      : filePath;

    // Resolve path relative to the contents directory
    const fullPath = path.resolve(contentsDir, cleanPath);

    return await fsPromises.readFile(fullPath, "utf8");
  } catch {
    return "";
  }
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
  default: ComponentType<unknown>;
  raw: string;
} | null> {
  try {
    // Strip leading slash if present for consistency
    const cleanPath = filePath.startsWith("/")
      ? filePath.substring(1)
      : filePath;

    // Create a dynamic import path that works reliably with Next.js
    // Using a relative path from the location of this file (lib/utils)
    const [contentModule, raw] = await Promise.all([
      import(`@repo/contents/${cleanPath}/${locale}.mdx`),
      getRawContent(`${cleanPath}/${locale}.mdx`),
    ]);

    const parsedMetadata = ContentMetadataSchema.parse(contentModule.metadata);

    return {
      metadata: parsedMetadata,
      default: contentModule.default,
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
  // Get all nested slug paths recursively
  const allSlugs = getNestedSlugs(basePath);

  // Early return if no slugs found
  if (allSlugs.length === 0) {
    return [];
  }

  // Fetch content for each slug path with better error handling and performance
  const contentPromises = allSlugs.map(async (slugArray) => {
    const slugPath = slugArray.join("/");
    const fullPath = `${basePath}/${slugPath}`;

    const content = await getContent(locale, fullPath);

    if (!content) {
      return null;
    }

    return {
      ...content.metadata,
      url: `/${locale}/${fullPath}`,
    };
  });

  // Wait for all promises and filter out nulls more efficiently
  const results = await Promise.all(contentPromises);

  // Filter out null results and ensure type safety
  return results.filter((item) => item !== null);
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
  const defaultExclude = ["_", "node_modules", ".next", ".git"];

  const effectiveExclude = exclude
    ? [...defaultExclude, ...exclude]
    : defaultExclude;

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
      dirNames = dirNames.filter((name) => {
        return !effectiveExclude.some(
          (excludeItem) => name === excludeItem || name.startsWith(excludeItem)
        );
      });
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
  if (
    (fullPath.endsWith(".mdx") || fullPath.endsWith(".md")) &&
    currentPath.length > 0
  ) {
    result.push([...currentPath]);
  }

  // Recursive case: explore children
  for (const child of children) {
    getNestedSlugs(basePath, [...currentPath, child], result);
  }

  return result;
}
