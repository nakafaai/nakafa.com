import fs, { promises as fsPromises } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ContentMetadata } from "@repo/contents/_types/content";
import {
  ContentMetadataSchema,
  ContentSchema,
  type Reference,
} from "@repo/contents/_types/content";
import type { Locale } from "next-intl";
import type { ComponentType } from "react";

// Get the directory where this file is located and resolve to contents directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use a more robust approach that works in both dev and production
const contentsDir = (() => {
  // First try the relative approach from current file location
  const relativePath = path.resolve(__dirname, "..");
  if (fs.existsSync(relativePath)) {
    return relativePath;
  }

  // Fallback: use process.cwd() and look for packages/contents
  const cwd = process.cwd();
  const cwdContents = path.join(cwd, "packages", "contents");
  if (fs.existsSync(cwdContents)) {
    return cwdContents;
  }

  // Last resort: try from workspace root (for monorepo setups)
  const workspaceRoot = path.resolve(cwd, "..", "..");
  const workspaceContents = path.join(workspaceRoot, "packages", "contents");
  if (fs.existsSync(workspaceContents)) {
    return workspaceContents;
  }

  // If all else fails, return the original relative path
  return relativePath;
})();

export async function debugDir() {
  const contentPath =
    "subject/university/bachelor/ai-ds/linear-methods/determinant-calculation";
  const content = await getContent("en", contentPath)
    .then((c) => c?.raw.slice(0, 100))
    .catch((e) => {
      return e;
    });

  const contents = await getContents({
    locale: "en",
    basePath: contentPath,
  })
    .then((c) => c?.map((item) => item.raw.slice(0, 100)))
    .catch((e) => {
      return e;
    });

  // const pathResolve = path.resolve(contentsDir, contentPath);
  // const pathRelative = path.relative(contentsDir, contentPath);
  // const filePath = path.join(process.cwd(), contentPath);

  // Additional debugging paths
  // const cwd = process.cwd();
  // const cwdContents = path.join(cwd, "packages", "contents");
  // const alternativePath = path.join(cwdContents, contentPath);

  const subjectDir = path.resolve(contentsDir, "subject");
  const categoryDir = path.resolve(subjectDir, "university");
  const gradeDir = path.resolve(categoryDir, "bachelor");
  const materialDir = path.resolve(gradeDir, "ai-ds");
  const chapterDir = path.resolve(materialDir, "linear-methods");
  const subChapterDir = path.resolve(chapterDir, "determinant-calculation");

  // see children of categoryDir
  const categoryChildren = fs.existsSync(categoryDir)
    ? fs.readdirSync(categoryDir, { withFileTypes: true })
    : [];
  const gradeChildren = fs.existsSync(gradeDir)
    ? fs.readdirSync(gradeDir, { withFileTypes: true })
    : [];
  const materialChildren = fs.existsSync(materialDir)
    ? fs.readdirSync(materialDir, { withFileTypes: true })
    : [];
  const chapterChildren = fs.existsSync(chapterDir)
    ? fs.readdirSync(chapterDir, { withFileTypes: true })
    : [];
  const subChapterChildren = fs.existsSync(subChapterDir)
    ? fs.readdirSync(subChapterDir, { withFileTypes: true })
    : [];

  const data = {
    // Environment info
    nodeEnv: process.env.NODE_ENV,
    platform: process.platform,
    // cwd,

    // File paths
    // fileName: __filename,
    // dirName: __dirname,
    contentsDir,
    subjectDir,
    categoryDir,
    gradeDir,
    materialDir,
    chapterDir,
    subChapterDir,
    categoryChildren,
    gradeChildren,
    materialChildren,
    chapterChildren,
    subChapterChildren,
    // pathResolve,
    // pathRelative,
    // filePath,
    // cwdContents,
    // alternativePath,
    // Existence checks
    // isFileNameExists: fs.existsSync(__filename),
    // isDirNameExists: fs.existsSync(__dirname),
    isContentsDirExists: fs.existsSync(contentsDir),
    isSubjectDirExists: fs.existsSync(subjectDir),
    isCategoryDirExists: fs.existsSync(categoryDir),
    isGradeDirExists: fs.existsSync(gradeDir),
    isMaterialDirExists: fs.existsSync(materialDir),
    isChapterDirExists: fs.existsSync(chapterDir),
    isSubChapterDirExists: fs.existsSync(subChapterDir),
    // isPathExists: fs.existsSync(pathResolve),
    // isPathExistsRelative: fs.existsSync(pathRelative),
    // isCwdContentsExists: fs.existsSync(cwdContents),
    // isAlternativePathExists: fs.existsSync(alternativePath),
    // Test to get the content
    content,
    contents,
  };

  return data;
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

    // Check if file exists before attempting to read
    const exists = await fsPromises
      .access(fullPath, fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      return "";
    }

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

  result.push({ slug: [basePath] });

  for (const nestedPath of nestedPaths) {
    result.push({ slug: [basePath, ...nestedPath] });
  }

  const promises = result.map(async (item) => {
    const content = await getContent(locale, item.slug.join("/"));
    if (!content) {
      return null;
    }

    const slug = `${locale}/${item.slug.join("/")}`;

    const { data, error } = ContentSchema.safeParse({
      metadata: content.metadata,
      raw: content.raw,
      url: `https://nakafa.com/${slug}`,
      slug,
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
  if (currentPath.length > 0) {
    result.push([...currentPath]);
  }

  // Recursive case: explore children
  for (const child of children) {
    getNestedSlugs(basePath, [...currentPath, child], result);
  }

  return result;
}
