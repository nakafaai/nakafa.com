import { generateSlugOnlyParams } from "@repo/contents/_lib/params";
import { routing } from "@repo/internationalization/src/routing";
import type { NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import { LLMS_CACHE_CONTROL } from "@/lib/llms/constants";
import { getLlmsMarkdownText } from "@/lib/llms/content";
import { stripLlmsRouteExtension } from "@/lib/llms/format";
import {
  buildRootLlmsIndexText,
  getCachedLlmsSectionIndexText,
} from "@/lib/llms/indexes";

const MARKDOWN_HEADERS = {
  "Cache-Control": LLMS_CACHE_CONTROL,
  "Content-Type": "text/markdown; charset=utf-8",
  Vary: "Accept",
};

const TEXT_HEADERS = {
  "Cache-Control": LLMS_CACHE_CONTROL,
  "Content-Type": "text/plain; charset=utf-8",
  Vary: "Accept",
};

/** Prebuilds markdown and llms index routes from existing content slugs. */
export function generateStaticParams() {
  return generateSlugOnlyParams({
    includeExerciseNumbers: true,
    includeExerciseSets: true,
    includeQuran: true,
  });
}

/** Serves section indexes or page-level markdown for agent retrieval. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/llms.mdx/[...slug]">
) {
  const { slug } = await ctx.params;
  const requestedLocale = slug[0];
  const hasLocalePrefix = hasLocale(routing.locales, requestedLocale);
  const locale = hasLocalePrefix ? requestedLocale : routing.defaultLocale;
  const slugParts = hasLocalePrefix ? slug.slice(1) : slug;
  const cleanSlug = stripLlmsRouteExtension(slugParts.join("/"));

  const sectionIndexText = await getCachedLlmsSectionIndexText({ cleanSlug });
  if (sectionIndexText) {
    return new Response(sectionIndexText, {
      headers: MARKDOWN_HEADERS,
    });
  }

  if (cleanSlug.startsWith("llms/")) {
    return new Response("Not found", {
      headers: TEXT_HEADERS,
      status: 404,
    });
  }

  const markdownText = await getLlmsMarkdownText({ cleanSlug, locale });
  if (markdownText) {
    return new Response(markdownText, {
      headers: MARKDOWN_HEADERS,
    });
  }

  if (cleanSlug === "llms") {
    return new Response(buildRootLlmsIndexText(), {
      headers: MARKDOWN_HEADERS,
    });
  }

  return new Response("Not found", {
    headers: TEXT_HEADERS,
    status: 404,
  });
}
