import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import { getFolderChildNames, getNestedSlugs } from "@repo/contents/_lib/fs";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { hasLocale, type Locale } from "next-intl";
import { getMetadataFromSlug } from "@/lib/utils/system";
import { generateOGImage } from "./og";

export const revalidate = false;

export function generateStaticParams() {
  const topDirs = Effect.runSync(
    Effect.match(getFolderChildNames("."), {
      onFailure: () => [],
      onSuccess: (names) => names,
    })
  );
  const result: { locale: string; slug: string[] }[] = [];
  const locales = routing.locales;

  for (const locale of locales) {
    result.push({ locale, slug: ["image.png"] });
    const slugs = getMDXSlugsForLocale(locale);
    const localeCache = new Set(slugs);

    if (!localeCache) {
      continue;
    }

    for (const topDir of topDirs) {
      if (localeCache.has(topDir)) {
        result.push(
          { locale, slug: [topDir] },
          { locale, slug: [topDir, "image.png"] }
        );
      }

      const nestedPaths = getNestedSlugs(topDir);

      for (const path of nestedPaths) {
        const fullPath = `${topDir}/${path.join("/")}`;

        if (localeCache.has(fullPath)) {
          result.push(
            { locale, slug: [topDir, ...path] },
            { locale, slug: [topDir, ...path, "image.png"] }
          );
        }
      }
    }
  }

  return result;
}

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/[locale]/og/[...slug]">
) {
  const { locale, slug } = await ctx.params;

  const cleanedLocale: Locale = hasLocale(routing.locales, locale)
    ? locale
    : routing.defaultLocale;

  const contentSlug = slug.at(-1) === "image.png" ? slug.slice(0, -1) : slug;

  const { title, description } = await Effect.runPromise(
    getMetadataFromSlug(cleanedLocale, contentSlug)
  );

  return generateOGImage({
    title,
    description,
  });
}
