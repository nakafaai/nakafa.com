import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import { getFolderChildNames, getNestedSlugs } from "@repo/contents/_lib/fs";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { hasLocale, type Locale } from "next-intl";
import { generateOGImage } from "@/app/[locale]/og/[...slug]/og";
import { getMetadataFromSlug } from "@/lib/utils/system";

export const revalidate = false;

export function generateStaticParams() {
  const topDirs = Effect.runSync(
    Effect.match(getFolderChildNames("."), {
      onFailure: () => [],
      onSuccess: (names) => names,
    })
  );
  const result: { slug: string[] }[] = [];
  const locales = routing.locales;

  for (const locale of locales) {
    result.push({ slug: [locale, "image.png"] });
    const slugs = getMDXSlugsForLocale(locale);
    const localeCache = new Set(slugs);

    if (!localeCache) {
      continue;
    }

    for (const topDir of topDirs) {
      if (localeCache.has(topDir)) {
        result.push(
          { slug: [locale, topDir] },
          { slug: [locale, topDir, "image.png"] }
        );
      }

      const nestedPaths = getNestedSlugs(topDir);

      for (const path of nestedPaths) {
        const fullPath = `${topDir}/${path.join("/")}`;

        if (localeCache.has(fullPath)) {
          result.push(
            { slug: [locale, topDir, ...path] },
            { slug: [locale, topDir, ...path, "image.png"] }
          );
        }
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

  const locale: Locale = hasLocale(routing.locales, slug[0])
    ? slug[0]
    : routing.defaultLocale;
  const cleanSlug: string[] = hasLocale(routing.locales, slug[0])
    ? slug.slice(1)
    : slug;

  const contentSlug =
    cleanSlug.at(-1) === "image.png" ? cleanSlug.slice(0, -1) : cleanSlug;

  const { title, description } = await Effect.runPromise(
    getMetadataFromSlug(locale, contentSlug)
  );

  return generateOGImage({
    title,
    description,
  });
}
