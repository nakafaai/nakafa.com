import { generateSlugOnlyParams } from "@repo/contents/_lib/static-params";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { hasLocale, type Locale } from "next-intl";
import { generateOGImage } from "@/app/[locale]/og/[...slug]/og";
import { getMetadataFromSlug } from "@/lib/utils/system";

export const revalidate = false;

export function generateStaticParams() {
  return generateSlugOnlyParams({
    includeOGVariants: true,
  });
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
