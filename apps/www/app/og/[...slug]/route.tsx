import { routing } from "@repo/internationalization/src/routing";
import type { NextRequest } from "next/server";
import { hasLocale, type Locale } from "next-intl";
import { readOgMetadata } from "@/app/og/content";
import { generateFallbackImage, generateOGImage } from "@/lib/og";

/** Renders the Open Graph image for one localized content route. */
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

  const copy = await readOgMetadata(locale, contentSlug);
  if (!copy) {
    return await generateFallbackImage(locale);
  }

  return await generateOGImage({
    title: copy.title,
    description: copy.description,
  });
}
