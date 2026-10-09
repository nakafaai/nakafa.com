import { routing } from "@repo/internationalization/src/routing";
import { Array as Arr, Option } from "effect";
import type { NextRequest } from "next/server";
import { hasLocale, type Locale } from "next-intl";
import { readOgMetadata } from "@/app/og/content";
import { generateOGImage } from "@/lib/og";
import { generateFallbackImage } from "@/lib/og/fallback";

/** Renders the localized Open Graph image for one content route. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/[locale]/og/[...slug]">
) {
  const { locale, slug } = await ctx.params;

  const cleanedLocale: Locale = hasLocale(routing.locales, locale)
    ? locale
    : routing.defaultLocale;

  const endsWithImageFile = Option.exists(
    Arr.last(slug),
    (segment) => segment === "image.png"
  );
  const contentSlug = endsWithImageFile ? Arr.dropRight(slug, 1) : slug;

  const copy = await readOgMetadata(cleanedLocale, contentSlug);
  if (!copy) {
    return await generateFallbackImage(cleanedLocale);
  }

  return await generateOGImage({
    title: copy.title,
    description: copy.description,
  });
}
