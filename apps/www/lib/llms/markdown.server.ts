import "@tanstack/react-start/server-only";

import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
} from "@repo/internationalization/src/locale";
import { AGENT_DISCOVERY_HEADERS } from "@repo/site/discovery";
import { Array as Arr, Effect } from "effect";
import { hasLocale } from "use-intl";
import { LLMS_CACHE_CONTROL } from "@/lib/llms/constants";
import { getLlmsMarkdownText } from "@/lib/llms/content/markdown";
import { stripLlmsRouteExtension } from "@/lib/llms/format";
import { getLlmsSectionIndexText } from "@/lib/llms/index/generate";
import {
  buildPublicLlmsAppSectionIndexText,
  buildRootLlmsIndexText,
  isPublicLlmsLocaleIndexRoute,
  resolvePublicLlmsSectionIndex,
} from "@/lib/llms/index/public";
import {
  LLMS_MARKDOWN_MEDIA_TYPE,
  LLMS_REPRESENTATION_VARY_FIELDS,
} from "@/lib/llms/routes";
import { buildUnsupportedMarkdownRouteText } from "@/lib/llms/unsupported";

const VARY = Arr.join(LLMS_REPRESENTATION_VARY_FIELDS, ", ");

/** The agent discovery headers, keyed by their field name. */
const AGENT_HEADERS = Object.fromEntries(
  AGENT_DISCOVERY_HEADERS.map(({ key, value }) => [key, value])
);

const MARKDOWN_HEADERS = {
  "Cache-Control": LLMS_CACHE_CONTROL,
  "Content-Type": LLMS_MARKDOWN_MEDIA_TYPE,
  Vary: VARY,
};

const TEXT_HEADERS = {
  "Cache-Control": LLMS_CACHE_CONTROL,
  "Content-Type": "text/plain; charset=utf-8",
  Vary: VARY,
};

const MARKDOWN_NOT_FOUND_HEADERS = {
  ...MARKDOWN_HEADERS,
  ...AGENT_HEADERS,
  "X-Robots-Tag": "noindex",
};

/** One Markdown request: the route without its locale and extension, and its locale. */
export interface LlmsMarkdownTarget {
  readonly cleanSlug: string;
  readonly hasLocalePrefix: boolean;
  readonly locale: Locale;
}

/** Answers one Markdown body with the representation headers. */
function markdownResponse(text: string | null) {
  return new Response(text, { headers: MARKDOWN_HEADERS });
}

/**
 * Answers the agent Markdown of one route. Section indexes come first, page
 * sources second, and the root index last. A known localized route without a
 * source answers 404 with a Markdown body, so agents get navigation help
 * without a soft 404.
 */
export const answerLlmsMarkdown = Effect.fn("www.llms.markdown.answer")(
  function* ({ cleanSlug, hasLocalePrefix, locale }: LlmsMarkdownTarget) {
    if (hasLocalePrefix && isPublicLlmsLocaleIndexRoute(cleanSlug)) {
      return markdownResponse(yield* getLlmsSectionIndexText(`llms/${locale}`));
    }

    if (cleanSlug === "llms") {
      return markdownResponse(buildRootLlmsIndexText());
    }

    if (hasLocalePrefix) {
      const publicSectionIndex = resolvePublicLlmsSectionIndex({
        cleanSlug,
        locale,
      });
      if (publicSectionIndex) {
        if (!publicSectionIndex.section) {
          return markdownResponse(
            buildPublicLlmsAppSectionIndexText({
              index: publicSectionIndex,
              locale,
            })
          );
        }
        return markdownResponse(
          yield* getLlmsSectionIndexText(
            `llms/${locale}/${publicSectionIndex.section}`
          )
        );
      }
    }

    const sectionIndexText = yield* getLlmsSectionIndexText(cleanSlug);
    if (sectionIndexText) {
      return markdownResponse(sectionIndexText);
    }

    if (cleanSlug.startsWith("llms/")) {
      return new Response("Not found", { headers: TEXT_HEADERS, status: 404 });
    }

    const markdownText = yield* getLlmsMarkdownText({ cleanSlug, locale });
    if (markdownText) {
      return markdownResponse(markdownText);
    }

    return new Response(
      buildUnsupportedMarkdownRouteText({
        locale,
        route: `/${cleanSlug}`,
      }),
      { headers: MARKDOWN_NOT_FOUND_HEADERS, status: 404 }
    );
  }
);

/**
 * Reads the locale and the route of a `/llms.mdx/...` path. The locale is
 * optional there: a path without a supported locale answers for the default
 * locale.
 */
export function readLlmsMarkdownTarget(
  segments: readonly string[]
): LlmsMarkdownTarget {
  const [requestedLocale] = segments;
  const hasLocalePrefix = hasLocale(LOCALES, requestedLocale);
  const locale: Locale = hasLocale(LOCALES, requestedLocale)
    ? requestedLocale
    : DEFAULT_LOCALE;
  const slugParts = hasLocalePrefix ? Arr.drop(segments, 1) : segments;

  return {
    cleanSlug: stripLlmsRouteExtension(Arr.join(slugParts, "/")),
    hasLocalePrefix,
    locale,
  };
}
