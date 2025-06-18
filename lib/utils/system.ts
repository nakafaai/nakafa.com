import fs from "node:fs";
import path from "node:path";
import { type ContentMetadata, ContentMetadataSchema } from "@/types/content";
import { getTranslations } from "next-intl/server";

/**
 * Gets the child names of the folder.
 * @param folder - The folder to get the child names for.
 * @param exclude - The names to exclude from the child names. can be the prefix of the folder or the folder name itself
 * @returns The child names of the folder.
 */
export function getFolderChildNames(folder: string, exclude?: string[]) {
  const defaultExclude = ["_"];

  const effectiveExclude = exclude
    ? [...defaultExclude, ...exclude]
    : defaultExclude;

  try {
    // For more reliable path resolution during both build and development
    const contentDir = path.join(process.cwd(), folder);

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
  const fullPath =
    currentPath.length === 0
      ? basePath
      : `${basePath}/${currentPath.join("/")}`;
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

type ParamConfig = {
  basePath: string;
  paramNames: string[];
  slugParam?: string;
  isDeep?: boolean;
};

/**
 * Generates static params for Next.js pages based on folder structure
 * @param config - Configuration for generating static params
 * @returns Array of parameter objects for generateStaticParams
 */
export function getStaticParams(
  config: ParamConfig
): Record<string, string | string[]>[] {
  const { basePath, paramNames, slugParam, isDeep = false } = config;

  if (paramNames.length === 0) {
    return [];
  }

  // Get first level folders
  const firstParam = paramNames[0];
  const firstLevelFolders = getFolderChildNames(basePath);

  if (paramNames.length === 1) {
    // Simple case: just return the first level folder names
    return firstLevelFolders.map((folder) => ({ [firstParam]: folder }));
  }

  // For nested structures, process recursively
  return firstLevelFolders.flatMap((firstFolder) => {
    // Handle the rest of the params
    const restParams = paramNames.slice(1);
    const nextBasePath = `${basePath}/${firstFolder}`;

    // For the last param level
    if (restParams.length === 1) {
      const lastParam = restParams[0];
      const folders = getFolderChildNames(nextBasePath);

      // If this is a catch-all slug parameter
      if (slugParam === lastParam && isDeep) {
        // For each entry at this level, we need to explore all possible nested paths
        const result: Record<string, string | string[]>[] = [];

        for (const folder of folders) {
          // Get all nested paths starting from this folder
          const slugBasePath = `${nextBasePath}/${folder}`;
          const nestedPaths = getNestedSlugs(slugBasePath);

          // Include the folder itself in the slug path
          // For example: "vectors/coordinate-system" becomes ["vectors", "coordinate-system"]
          for (const nestedPath of nestedPaths) {
            result.push({
              [firstParam]: firstFolder,
              [lastParam]: [folder, ...nestedPath],
            });
          }

          // Also include the folder itself as a valid path
          result.push({
            [firstParam]: firstFolder,
            [lastParam]: [folder],
          });
        }

        return result;
      }

      // Standard case
      return folders.map((folder) => ({
        [firstParam]: firstFolder,
        [lastParam]: folder,
      }));
    }

    // Recursive case - need to go deeper
    const nestedConfig: ParamConfig = {
      basePath: nextBasePath,
      paramNames: restParams,
      slugParam,
      isDeep,
    };

    const nestedParams = getStaticParams(nestedConfig);

    // Combine the current param with nested params
    return nestedParams.map((nestedParam) => ({
      [firstParam]: firstFolder,
      ...nestedParam,
    }));
  });
}

/**
 * Gets the title and description from an MDX file based on the slug
 * @param locale - The locale for the content
 * @param slug - The slug parts as an array of strings (e.g. ["articles", "politics", "nepotism"])
 * @returns An object containing the title and description, or default values if not found
 */
export async function getMetadataFromSlug(
  locale: string,
  slug: string[]
): Promise<ContentMetadata> {
  const [tCommon, tMetadata] = await Promise.all([
    getTranslations("Common"),
    getTranslations("Metadata"),
  ]);
  const defaultTitle = tCommon("made-with-love");
  try {
    // Build the path to the MDX file
    const slugPath = slug.join("/");

    // Dynamically import the MDX file to get its metadata
    const contentModule = await import(`@/contents/${slugPath}/${locale}.mdx`);

    const parsed = ContentMetadataSchema.parse(contentModule.metadata);

    // Get the title and description from the metadata
    const title = parsed.title || defaultTitle;
    const description =
      parsed.description || parsed.subject || tMetadata("short-description");

    return { ...parsed, title, description };
  } catch {
    // Return default values if there's an error
    return {
      title: defaultTitle,
      description: tMetadata("short-description"),
      authors: [{ name: "Nakafa" }],
      date: "",
    };
  }
}
