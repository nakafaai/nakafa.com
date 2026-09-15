import { routing } from "@repo/internationalization/src/routing";
import type { NextRequest } from "next/server";
import { hasLocale, type Locale } from "next-intl";
import { readOgMetadata } from "@/app/og/content";
import { generateFallbackImage, generateOGImage } from "@/lib/og";

/** Renders the localized Open Graph image for one content route. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/[locale]/og/[...slug]">
) {
  const { locale, slug } = await ctx.params;

  const cleanedLocale: Locale = hasLocale(routing.locales, locale)
    ? locale
    : routing.defaultLocale;

  const contentSlug = slug.at(-1) === "image.png" ? slug.slice(0, -1) : slug;

  const copy = await readOgMetadata(cleanedLocale, contentSlug);
  if (!copy) {
    return await generateFallbackImage(cleanedLocale);
  }

  return await generateOGImage({
    title: copy.title,
    description: copy.description,
  });
}
