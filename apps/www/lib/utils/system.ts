import { getFolderChildNames } from "@repo/contents/_lib/fs/cache";
import { getNestedSlugs } from "@repo/contents/_lib/fs/nested-slugs";
import { getContentMetadata } from "@repo/contents/_lib/metadata";
import type { ContentMetadata } from "@repo/contents/_types/content";
import { Data, Effect, Option } from "effect";
import { cacheLife } from "next/cache";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";

class TranslationLoadError extends Data.TaggedError("TranslationLoadError")<{
  readonly namespace: string;
  readonly locale: Locale;
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

type StaticParam = Record<string, string | string[]>;

/**
 * Generates static params for Next.js pages based on folder structure
 * @param config - Configuration for generating static params
 * @returns Array of parameter objects for generateStaticParams
 */
export function getStaticParams(config: ParamConfig): Promise<StaticParam[]> {
  return Effect.runPromise(getStaticParamsEffect(config));
}

/** Builds static params from content folders as a native Effect program. */
function getStaticParamsEffect(
  config: ParamConfig
): Effect.Effect<StaticParam[]> {
  const { basePath, paramNames, slugParam, isDeep = false } = config;

  if (paramNames.length === 0) {
    return Effect.succeed([]);
  }

  return Effect.gen(function* () {
    const firstParam = paramNames[0];
    const firstLevelFolders = yield* Effect.match(
      getFolderChildNames(basePath),
      {
        onFailure: () => [],
        onSuccess: (names) => names,
      }
    );

    if (paramNames.length === 1) {
      return firstLevelFolders.map((folder) => ({ [firstParam]: folder }));
    }

    const params: StaticParam[] = [];

    for (const firstFolder of firstLevelFolders) {
      const restParams = paramNames.slice(1);
      const nextBasePath = `${basePath}/${firstFolder}`;

      if (restParams.length === 1) {
        const lastParam = restParams[0];
        const folders = yield* Effect.match(getFolderChildNames(nextBasePath), {
          onFailure: () => [],
          onSuccess: (names) => names,
        });

        if (slugParam === lastParam && isDeep) {
          const result: StaticParam[] = [];

          for (const folder of folders) {
            const slugBasePath = `${nextBasePath}/${folder}`;
            const nestedPaths = yield* getNestedSlugs(slugBasePath);

            result.push({
              [firstParam]: firstFolder,
              [lastParam]: [folder],
            });

            if (nestedPaths.length === 0) {
              continue;
            }

            for (const nestedPath of nestedPaths) {
              result.push({
                [firstParam]: firstFolder,
                [lastParam]: [folder, ...nestedPath],
              });
            }
          }

          params.push(...result);
          continue;
        }

        params.push(
          ...folders.map((folder) => ({
            [firstParam]: firstFolder,
            [lastParam]: folder,
          }))
        );
        continue;
      }

      const nestedParams = yield* getStaticParamsEffect({
        basePath: nextBasePath,
        paramNames: restParams,
        slugParam,
        isDeep,
      });

      params.push(
        ...nestedParams.map((nestedParam) => ({
          [firstParam]: firstFolder,
          ...nestedParam,
        }))
      );
    }

    return params;
  }).pipe(Effect.withSpan("www.system.getStaticParams"));
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

/**
 * Resolves one content metadata payload inside a Cache Components-safe helper for
 * route handlers that need static image generation.
 */
export async function getCachedMetadataFromSlug(
  locale: Locale,
  slug: string[]
) {
  "use cache";

  cacheLife("max");

  return await Effect.runPromise(getMetadataFromSlug(locale, slug));
}
