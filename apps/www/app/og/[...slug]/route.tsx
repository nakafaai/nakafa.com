import { getFolderChildNames, getNestedSlugs } from "@repo/contents/_lib/utils";
import { routing } from "@repo/internationalization/src/routing";
import type { NextRequest } from "next/server";
import { hasLocale, type Locale } from "next-intl";
import { generateOGImage } from "@/app/[locale]/og/[...slug]/og";
import { getMetadataFromSlug } from "@/lib/utils/system";

export const revalidate = false;

export function generateStaticParams() {
  // Top level directories in contents
  const topDirs = getFolderChildNames(".");
  const result: { locale: string; slug: string[] }[] = [];
  const locales = routing.locales;

  // For each locale
  for (const locale of locales) {
    // Add both with and without image.png
    result.push({ locale, slug: ["image.png"] });

    // For each top directory (articles, subject, etc)
    for (const topDir of topDirs) {
      // Get all nested paths starting from this folder
      const nestedPaths = getNestedSlugs(topDir);

      // Add the top-level folder itself (with and without image.png)
      result.push(
        { locale, slug: [topDir] },
        { locale, slug: [topDir, "image.png"] }
      );

      // Add each nested path (with and without image.png)
      for (const path of nestedPaths) {
        result.push(
          { locale, slug: [topDir, ...path] },
          { locale, slug: [topDir, ...path, "image.png"] }
        );
      }
    }
  }

  return result;
}

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/og/[...slug]">
) {
  const { slug } = await ctx.params;

  // Parse locale from slug
  const locale: Locale = hasLocale(routing.locales, slug[0])
    ? slug[0]
    : routing.defaultLocale;
  const cleanSlug: string[] = hasLocale(routing.locales, slug[0])
    ? slug.slice(1)
    : slug;

  // If last element is "image.png", remove it
  // The rest of the path is the content path
  const contentSlug =
    cleanSlug.at(-1) === "image.png" ? cleanSlug.slice(0, -1) : cleanSlug;

  // Get metadata from the content path
  const { title, description } = await getMetadataFromSlug(locale, contentSlug);

  return generateOGImage({
    title,
    description,
  });
}
