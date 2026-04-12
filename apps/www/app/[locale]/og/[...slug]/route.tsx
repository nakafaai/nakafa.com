import { routing } from "@repo/internationalization/src/routing";
import type { NextRequest } from "next/server";
import { hasLocale, type Locale } from "next-intl";
import { generateOGImage } from "@/lib/og";
import { getCachedMetadataFromSlug } from "@/lib/utils/system";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/[locale]/og/[...slug]">
) {
  const { locale, slug } = await ctx.params;

  const cleanedLocale: Locale = hasLocale(routing.locales, locale)
    ? locale
    : routing.defaultLocale;

  const contentSlug = slug.at(-1) === "image.png" ? slug.slice(0, -1) : slug;

  const { title, description } = await getCachedMetadataFromSlug(
    cleanedLocale,
    contentSlug
  );

  return await generateOGImage({
    title,
    description,
  });
}
