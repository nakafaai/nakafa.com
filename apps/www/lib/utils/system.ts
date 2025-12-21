import { getFolderChildNames, getNestedSlugs } from "@repo/contents/_lib/utils";
import {
  type ContentMetadata,
  ContentMetadataSchema,
} from "@repo/contents/_types/content";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";

interface ParamConfig {
  basePath: string;
  paramNames: string[];
  slugParam?: string;
  isDeep?: boolean;
}

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
  locale: Locale,
  slug: string[]
): Promise<ContentMetadata> {
  const [tCommon, tMetadata] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Metadata" }),
  ]);
  const defaultTitle = tCommon("made-with-love");
  try {
    // Build the path to the MDX file
    const slugPath = slug.join("/");

    // Dynamically import the MDX file to get its metadata
    const contentModule = await import(
      `@repo/contents/${slugPath}/${locale}.mdx`
    );

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
