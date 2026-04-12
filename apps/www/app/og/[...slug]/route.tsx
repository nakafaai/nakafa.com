import { routing } from "@repo/internationalization/src/routing";
import type { NextRequest } from "next/server";
import { hasLocale, type Locale } from "next-intl";
import { generateOGImage } from "@/lib/og";
import { getCachedMetadataFromSlug } from "@/lib/utils/system";

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

  const { title, description } = await getCachedMetadataFromSlug(
    locale,
    contentSlug
  );

  return await generateOGImage({
    title,
    description,
  });
}
