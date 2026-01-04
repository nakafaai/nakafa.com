import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import { getFolderChildNames, getNestedSlugs } from "@repo/contents/_lib/fs";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";

interface GenerateStaticParamsConfig {
  basePath: string;
  locales?: string[];
}

interface StaticParamsResult {
  locale: string;
  slug: string[];
}

/**
 * Generates static params for content pages based on the configuration.
 * @param config - The configuration for generating static params.
 * @returns An array of StaticParamsResult objects. With each object
 * containing a locale and a slug path.
 */
export function generateStaticParamsForContent(
  config: GenerateStaticParamsConfig
): StaticParamsResult[] {
  const { basePath, locales = routing.locales } = config;

  const mdxSlugsByLocale = new Map<string, Set<string>>();
  const allFolderPaths = new Set<string>();

  for (const locale of locales) {
    const mdxSlugs = getMDXSlugsForLocale(locale);
    const localeSlugs = new Set(
      mdxSlugs
        .filter((slug) => slug.startsWith(`${basePath}/`))
        .map((slug) => slug.slice(basePath.length + 1))
    );
    mdxSlugsByLocale.set(locale, localeSlugs);
  }

  const topDirs = Effect.runSync(
    Effect.match(getFolderChildNames(basePath), {
      onFailure: () => [],
      onSuccess: (names) => names,
    })
  );

  for (const topDir of topDirs) {
    const topLevelPath = topDir;
    allFolderPaths.add(topLevelPath);

    const nestedPaths = getNestedSlugs(`${basePath}/${topDir}`);

    for (const path of nestedPaths) {
      const fullPath = `${topDir}/${path.join("/")}`;
      allFolderPaths.add(fullPath);
    }
  }

  const result: StaticParamsResult[] = [];

  for (const [locale, mdxSlugs] of mdxSlugsByLocale.entries()) {
    for (const folderPath of allFolderPaths) {
      result.push({
        locale,
        slug: folderPath.split("/"),
      });
    }

    for (const mdxSlug of mdxSlugs) {
      const slugParts = mdxSlug.split("/");
      const slugPath = slugParts.join("/");

      if (!allFolderPaths.has(slugPath)) {
        result.push({
          locale,
          slug: slugParts,
        });
      }
    }
  }

  return result;
}
