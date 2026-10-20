import "@tanstack/react-start/server-only";

import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  LocaleSchema,
} from "@repo/internationalization/src/locale";
import { AGENT_DISCOVERY_HEADERS } from "@repo/site/discovery";
import { Array as Arr, Effect, Option, Record as Rec, Schema } from "effect";
import { hasLocale } from "use-intl";
import {
  CONTENT_LLMS_CACHE_TAG,
  LLMS_CACHE_CONTROL,
} from "@/lib/llms/constants";
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
const AGENT_HEADERS = Rec.fromEntries(
  Arr.map(AGENT_DISCOVERY_HEADERS, ({ key, value }) => [key, value] as const)
);

/** Every answer depends on the release, so the CDN purges it with the corpus. */
const MARKDOWN_HEADERS = {
  "Cache-Control": LLMS_CACHE_CONTROL,
  "Content-Type": LLMS_MARKDOWN_MEDIA_TYPE,
  "Vercel-Cache-Tag": CONTENT_LLMS_CACHE_TAG,
  Vary: VARY,
};

const TEXT_HEADERS = {
  "Cache-Control": LLMS_CACHE_CONTROL,
  "Content-Type": "text/plain; charset=utf-8",
  "Vercel-Cache-Tag": CONTENT_LLMS_CACHE_TAG,
  Vary: VARY,
};

const MARKDOWN_NOT_FOUND_HEADERS = {
  ...MARKDOWN_HEADERS,
  ...AGENT_HEADERS,
  "X-Robots-Tag": "noindex",
};

/** One Markdown request: the route without its locale and extension, and its locale. */
const LlmsMarkdownTargetSchema = Schema.Struct({
  cleanSlug: Schema.String,
  hasLocalePrefix: Schema.Boolean,
  locale: LocaleSchema,
});
type LlmsMarkdownTarget = typeof LlmsMarkdownTargetSchema.Type;

/** Answers one Markdown body with the representation headers. */
function markdownResponse(text: string) {
  return new Response(text, { headers: MARKDOWN_HEADERS });
}

/** Answers the body of one index, or a plain not found when the index names no body. */
function indexResponse(text: Option.Option<string>) {
  return Option.match(text, {
    onNone: () =>
      new Response("Not found", { headers: TEXT_HEADERS, status: 404 }),
    onSome: markdownResponse,
  });
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
      return indexResponse(
        Option.fromNullishOr(yield* getLlmsSectionIndexText(`llms/${locale}`))
      );
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
        return indexResponse(
          Option.fromNullishOr(
            yield* getLlmsSectionIndexText(
              `llms/${locale}/${publicSectionIndex.section}`
            )
          )
        );
      }
    }

    const sectionIndex = Option.fromNullishOr(
      yield* getLlmsSectionIndexText(cleanSlug)
    );
    if (Option.isSome(sectionIndex)) {
      return markdownResponse(sectionIndex.value);
    }

    if (cleanSlug.startsWith("llms/")) {
      return new Response("Not found", { headers: TEXT_HEADERS, status: 404 });
    }

    const markdownText = Option.fromNullishOr(
      yield* getLlmsMarkdownText({ cleanSlug, locale })
    );
    if (Option.isSome(markdownText)) {
      return markdownResponse(markdownText.value);
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
