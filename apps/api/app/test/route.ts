import {
  getContent,
  getFolderChildNames,
  getNestedSlugs,
} from "@repo/contents/_lib/utils";
import { routing } from "@repo/internationalization/src/routing";

export const revalidate = false;

export async function GET(_req: Request) {
  const topDirs = getFolderChildNames(".");
  const result: { locale: string; slug: string[] }[] = [];
  const locales = routing.locales;

  // For each locale
  for (const locale of locales) {
    // For each top directory (articles, subject, etc)
    for (const topDir of topDirs) {
      // Get all nested paths starting from this folder
      const nestedPaths = getNestedSlugs(topDir);

      // Add the top-level folder itself
      result.push({
        locale,
        slug: [topDir],
      });

      // Add each nested path
      for (const path of nestedPaths) {
        result.push({
          locale,
          slug: [topDir, ...path],
        });
      }
    }
  }

  const promises = result.map(async (item) => {
    const content = await getContent(item.locale, item.slug.join("/"));
    if (!content) {
      return null;
    }

    return {
      ...content.metadata,
      url: `/${item.locale}/${item.slug.join("/")}`,
    };
  });

  const contents = await Promise.all(promises).then((results) =>
    results.filter((item) => item !== null)
  );

  return new Response(JSON.stringify(contents, null, 2));
}
