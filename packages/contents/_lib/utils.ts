import fs, { promises as fsPromises } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ContentMetadata } from "@repo/contents/_types/content";
import {
  ContentMetadataSchema,
  type Reference,
} from "@repo/contents/_types/content";
import type { Locale } from "next-intl";
import type { ComponentType } from "react";

// Get the directory where this file is located and resolve to contents directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Checks if a directory looks like a contents directory.
 * @param dirPath - The path to the directory to check.
 * @returns True if the directory looks like a contents directory, false otherwise.
 */
function isContentsDir(dirPath: string): boolean {
  if (!fs.existsSync(dirPath)) {
    return false;
  }

  try {
    const items = fs.readdirSync(dirPath);
    // Check for typical contents directory structure
    // Look for common content folders or _lib, _types, _components directories
    const hasContentStructure = items.some(
      (item) => item === "subject" || item === "articles"
    );
    return hasContentStructure;
  } catch {
    return false;
  }
}

/**
 * Finds the contents directory dynamically.
 * @returns The path to the contents directory.
 */
function findContentsDir(): string {
  // In production (Vercel), the contents are likely copied to the app directory
  // because of the "Include files outside the root directory" setting

  // Try from the app's working directory first (production)
  const possiblePaths = [
    // Development: relative to this file
    path.resolve(__dirname, ".."),
    // Production: Check if contents are in the current working directory
    path.join(process.cwd(), "packages", "contents"),
    // Production: Turborepo build output
    path.join(process.cwd(), "node_modules", "@repo", "contents"),
    path.join(process.cwd(), "node_modules", "@repo", "contents", "dist"),
    path.join(process.cwd(), "..", "..", "packages", "contents"),
    path.join(process.cwd(), "..", "..", "packages", "contents", "dist"),
    // Production: contents copied to app directory
    path.join(process.cwd(), "contents"),
    // Alternative production paths
    path.join(process.cwd(), "..", "..", "..", "packages", "contents"),
    path.join(process.cwd(), "..", "packages", "contents"),
    // Vercel specific paths
    path.join("/var/task", "packages", "contents"),
    path.join("/var/task", "node_modules", "@repo", "contents"),
  ];

  for (const possiblePath of possiblePaths) {
    if (isContentsDir(possiblePath)) {
      return possiblePath;
    }
  }

  // Last resort: return the development path
  return path.resolve(__dirname, "..");
}

const contentsDir = findContentsDir();

/**
 * Debug function to understand the file system structure in different environments.
 * @returns The debug object.
 */
export function debugFileSystem() {
  const possiblePaths = [
    path.resolve(__dirname, ".."),
    path.join(process.cwd(), "node_modules", "@repo", "contents", "dist"),
    path.join(process.cwd(), "..", "..", "packages", "contents", "dist"),
    path.join(process.cwd(), "packages", "contents"),
    path.join(process.cwd(), "contents"),
    path.join(process.cwd(), "..", "..", "packages", "contents"),
    path.join(process.cwd(), "..", "..", "..", "packages", "contents"),
    path.join(process.cwd(), "..", "packages", "contents"),
  ];

  const pathResults = possiblePaths.map((p) => ({
    path: p,
    exists: fs.existsSync(p),
    isContentsDir: fs.existsSync(p) ? isContentsDir(p) : false,
    contents: fs.existsSync(p)
      ? (() => {
          try {
            return fs.readdirSync(p).slice(0, 10); // First 10 items
          } catch {
            return ["Error reading"];
          }
        })()
      : [],
  }));

  const debug = {
    nodeEnv: process.env.NODE_ENV,
    cwd: process.cwd(),
    __dirname,
    __filename,
    contentsDir,
    contentsDirExists: fs.existsSync(contentsDir),
    possiblePaths: pathResults,
    cwdContents: [] as string[],
    contentsDirContents: [] as string[],
  };

  try {
    debug.cwdContents = fs.readdirSync(process.cwd()).slice(0, 20);
  } catch {
    debug.cwdContents = ["Error reading cwd"];
  }

  try {
    if (fs.existsSync(contentsDir)) {
      debug.contentsDirContents = fs.readdirSync(contentsDir).slice(0, 20);
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
  const result: { slug: string[] }[] = [];

  const nestedPaths = getNestedSlugs(basePath);

  for (const nestedPath of nestedPaths) {
    result.push({ slug: nestedPath });
  }

  const promises = result.map(async (item) => {
    const content = await getContent(locale, item.slug.join("/"));
    if (!content) {
      return null;
    }

    return {
      ...content.metadata,
      url: `/${locale}/${item.slug.join("/")}`,
    };
  });

  const contents = await Promise.all(promises).then((results) =>
    results.filter((item) => item !== null)
  );

  return contents;
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
