import { generateSlugOnlyParams } from "@repo/contents/_lib/static-params";
import { routing } from "@repo/internationalization/src/routing";
import type { NextRequest } from "next/server";
import { hasLocale, type Locale } from "next-intl";
import {
  getCachedLlmsExerciseText,
  getCachedLlmsIndexText,
  getCachedLlmsMdxText,
  getQuranLlmsText,
} from "@/lib/llms";

export function generateStaticParams() {
  return generateSlugOnlyParams({
    includeExerciseNumbers: true,
    includeExerciseSets: true,
    includeQuran: true,
  });
}

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/llms.mdx/[...slug]">
) {
  const { slug } = await ctx.params;
  const locale: Locale = hasLocale(routing.locales, slug[0])
    ? slug[0]
    : routing.defaultLocale;
  const cleanSlug = hasLocale(routing.locales, slug[0])
    ? slug.slice(1).join("/")
    : slug.join("/");

  const quranText = getQuranLlmsText({ cleanSlug, locale });
  if (quranText) {
    return new Response(quranText);
  }

  const exerciseText = await getCachedLlmsExerciseText({ cleanSlug, locale });
  if (exerciseText) {
    return new Response(exerciseText);
  }

  const mdxText = await getCachedLlmsMdxText({ cleanSlug, locale });
  if (mdxText) {
    return new Response(mdxText);
  }

  return new Response(await getCachedLlmsIndexText());
}
