import { getContentMetadata } from "@repo/contents/_lib/content";
import { getFolderChildNames, getNestedSlugs } from "@repo/contents/_lib/fs";
import type { ContentMetadata } from "@repo/contents/_types/content";
import { Data, Effect, Option } from "effect";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";

class TranslationLoadError extends Data.TaggedError("TranslationLoadError")<{
  readonly namespace: string;
  readonly locale: string;
}> {}

class MetadataNotFoundError extends Data.TaggedError("MetadataNotFoundError")<{
  readonly slug: string;
}> {}

interface ParamConfig {
  basePath: string;
  isDeep?: boolean;
  paramNames: string[];
  slugParam?: string;
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
  const firstLevelFolders = Effect.runSync(
    Effect.match(getFolderChildNames(basePath), {
      onFailure: () => [],
      onSuccess: (names) => names,
    })
  );

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
      const folders = Effect.runSync(
        Effect.match(getFolderChildNames(nextBasePath), {
          onFailure: () => [],
          onSuccess: (names) => names,
        })
      );

      // If this is a catch-all slug parameter with deep nesting
      if (slugParam === lastParam && isDeep) {
        // For each entry at this level, we need to explore all possible nested paths
        const result: Record<string, string | string[]>[] = [];

        for (const folder of folders) {
          const slugBasePath = `${nextBasePath}/${folder}`;

          // Get all nested paths starting from this folder
          const nestedPaths = getNestedSlugs(slugBasePath);

          if (nestedPaths.length === 0) {
            // If no nested paths, include the folder itself as a valid path
            result.push({
              [firstParam]: firstFolder,
              [lastParam]: [folder],
            });
          } else {
            // Include the folder itself as a valid path
            result.push({
              [firstParam]: firstFolder,
              [lastParam]: [folder],
            });

            // Include nested paths with the folder as the first element
            for (const nestedPath of nestedPaths) {
              result.push({
                [firstParam]: firstFolder,
                [lastParam]: [folder, ...nestedPath],
              });
            }
          }
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
 * @returns Effect that resolves to ContentMetadata with title and description
 */
export function getMetadataFromSlug(
  locale: Locale,
  slug: string[]
): Effect.Effect<
  ContentMetadata,
  TranslationLoadError | MetadataNotFoundError
> {
  return Effect.gen(function* () {
    const [tCommon, tMetadata] = yield* Effect.all(
      [
        Effect.tryPromise({
          try: () => getTranslations({ locale, namespace: "Common" }),
          catch: () =>
            new TranslationLoadError({ namespace: "Common", locale }),
        }),
        Effect.tryPromise({
          try: () => getTranslations({ locale, namespace: "Metadata" }),
          catch: () =>
            new TranslationLoadError({ namespace: "Metadata", locale }),
        }),
      ],
      { concurrency: "unbounded" }
    );

    const defaultTitle = tCommon("made-with-love");
    const shortDescription = tMetadata("short-description");
    const slugPath = slug.join("/");

    const defaultMetadata: ContentMetadata = {
      title: defaultTitle,
      description: shortDescription,
      authors: [{ name: "Nakafa" }],
      date: "",
    };

    const contentMetadata = yield* Effect.catchAll(
      getContentMetadata(slugPath, locale),
      () => Effect.succeed(null)
    );
    const metadata = Option.fromNullable(contentMetadata);

    if (Option.isNone(metadata)) {
      return defaultMetadata;
    }

    const metadataValue = metadata.value;
    const title = metadataValue.title || defaultTitle;
    const description =
      metadataValue.description || metadataValue.subject || shortDescription;

    return { ...metadataValue, title, description };
  });
}
