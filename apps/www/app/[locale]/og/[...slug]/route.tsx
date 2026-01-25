import { generateAllContentParams } from "@repo/contents/_lib/static-params";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { hasLocale, type Locale } from "next-intl";
import { getMetadataFromSlug } from "@/lib/utils/system";
import { generateOGImage } from "./og";

export const revalidate = false;

export function generateStaticParams() {
  return generateAllContentParams({
    includeOGVariants: true,
  });
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
