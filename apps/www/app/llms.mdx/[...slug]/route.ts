import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import {
  AGENT_DISCOVERY_LINK_HEADER,
  LLMS_TEXT_PATH,
} from "@/lib/agent-discovery";
import { LLMS_CACHE_CONTROL } from "@/lib/llms/constants";
import { getLlmsMarkdownText } from "@/lib/llms/content";
import { stripLlmsRouteExtension } from "@/lib/llms/format";
import { getCachedLlmsSectionIndexText } from "@/lib/llms/indexes";
import {
  buildPublicLlmsAppSectionIndexText,
  buildRootLlmsIndexText,
  resolvePublicLlmsSectionIndex,
} from "@/lib/llms/public-index";
import { buildUnsupportedMarkdownRouteText } from "@/lib/llms/unsupported";

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

const MARKDOWN_NOT_FOUND_HEADERS = {
  ...MARKDOWN_HEADERS,
  Link: AGENT_DISCOVERY_LINK_HEADER,
  "X-Llms-Txt": LLMS_TEXT_PATH,
  "X-Robots-Tag": "noindex",
};

/**
 * Serves source-backed markdown for agent retrieval.
 *
 * Section indexes are resolved first, page markdown sources second, and the
 * root llms index last. Known localized routes without source return 404 with
 * a markdown body so agents get navigation help without a soft 404.
 */
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

  const isPublicLocaleIndex =
    hasLocalePrefix && (cleanSlug === "" || cleanSlug === "llms");
  if (isPublicLocaleIndex) {
    const localeIndexText = await getCachedLlmsSectionIndexText({
      cleanSlug: `llms/${locale}`,
    });

    return new Response(localeIndexText, {
      headers: MARKDOWN_HEADERS,
    });
  }

  if (cleanSlug === "llms") {
    return new Response(buildRootLlmsIndexText(), {
      headers: MARKDOWN_HEADERS,
    });
  }

  const publicSectionIndex = hasLocalePrefix
    ? resolvePublicLlmsSectionIndex({ cleanSlug, locale })
    : null;
  if (publicSectionIndex) {
    if (!publicSectionIndex.section) {
      return new Response(
        buildPublicLlmsAppSectionIndexText({
          index: publicSectionIndex,
          locale,
        }),
        { headers: MARKDOWN_HEADERS }
      );
    }

    const publicIndexText = await getCachedLlmsSectionIndexText({
      cleanSlug: `llms/${locale}/${publicSectionIndex.section}`,
    });

    return new Response(publicIndexText, {
      headers: MARKDOWN_HEADERS,
    });
  }

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

  const markdownText = await Effect.runPromise(
    getLlmsMarkdownText({ cleanSlug, locale })
  );
  if (markdownText) {
    return new Response(markdownText, {
      headers: MARKDOWN_HEADERS,
    });
  }

  return new Response(
    buildUnsupportedMarkdownRouteText({
      locale,
      route: `/${cleanSlug}`,
    }),
    {
      headers: MARKDOWN_NOT_FOUND_HEADERS,
      status: 404,
    }
  );
}
