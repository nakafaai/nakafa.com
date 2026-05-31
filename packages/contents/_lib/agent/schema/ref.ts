import { NAKAFA_AGENT_SECTIONS } from "@repo/contents/_lib/agent/constants";
import { LocaleSchema } from "@repo/contents/_types/content";
import { Option, Schema } from "effect";

const MARKDOWN_EXTENSION = ".md";
const NAKAFA_CONTENT_URL_HOSTNAMES = ["nakafa.com", "www.nakafa.com"] as const;

const UrlStringSchema = Schema.String.pipe(
  Schema.filter((value) => URL.canParse(value), {
    message: () => "Expected a valid URL.",
  })
);

/**
 * Checks whether a string is a safe locale-free content route.
 */
function isSafeNakafaContentRoute(value: string) {
  if (value.length === 0) {
    return false;
  }

  return value
    .split("/")
    .every(
      (segment) => segment.length > 0 && segment !== "." && segment !== ".."
    );
}

/**
 * Checks whether a string is a safe locale-prefixed content ID.
 */
function isSafeNakafaContentId(value: string) {
  const [locale, ...routeSegments] = value.split("/");
  const parsedLocale = Schema.decodeUnknownOption(LocaleSchema)(locale);

  if (Option.isNone(parsedLocale)) {
    return false;
  }

  return isSafeNakafaContentRoute(routeSegments.join("/"));
}

/**
 * Checks whether a URL points at Nakafa's public content origin.
 */
function isNakafaContentUrl(value: string) {
  if (!URL.canParse(value)) {
    return false;
  }

  const url = new URL(value);

  return (
    url.protocol === "https:" &&
    NAKAFA_CONTENT_URL_HOSTNAMES.some((hostname) => hostname === url.hostname)
  );
}

/**
 * Runtime schema for stable Nakafa content IDs returned by agent tools.
 *
 * @see https://effect.website/docs/code-style/branded-types/
 */
export const NakafaAgentContentIdSchema = Schema.String.pipe(
  Schema.filter(isSafeNakafaContentId, {
    message: () =>
      "Expected a locale-prefixed Nakafa content ID with a safe route.",
  }),
  Schema.brand("@Nakafa/AgentContentId")
).annotations({
  description: "Stable locale-prefixed content identifier returned by Nakafa.",
});

/** Runtime schema for locale-free Nakafa content routes. */
export const NakafaAgentContentRouteSchema = Schema.String.pipe(
  Schema.filter(isSafeNakafaContentRoute, {
    message: () => "Expected a safe locale-free Nakafa content route.",
  }),
  Schema.brand("@Nakafa/AgentContentRoute")
).annotations({
  description: "Locale-free route under the Nakafa content tree.",
});

/** Runtime schema for canonical public Nakafa content URLs. */
export const NakafaAgentContentUrlSchema = UrlStringSchema.pipe(
  Schema.filter(isNakafaContentUrl, {
    message: () => "Expected a canonical Nakafa content URL.",
  }),
  Schema.brand("@Nakafa/AgentContentUrl")
).annotations({
  description: "Canonical public Nakafa URL for citation.",
});

/** Runtime schema for canonical public Nakafa markdown URLs. */
export const NakafaAgentMarkdownUrlSchema = UrlStringSchema.pipe(
  Schema.filter(
    (value) =>
      isNakafaContentUrl(value) &&
      new URL(value).pathname.endsWith(MARKDOWN_EXTENSION),
    {
      message: () => "Expected a canonical Nakafa markdown URL.",
    }
  ),
  Schema.brand("@Nakafa/AgentMarkdownUrl")
).annotations({
  description: "Canonical markdown URL for focused agent retrieval.",
});

/** Runtime schema for public Nakafa sections exposed to agents. */
export const NakafaAgentSectionSchema = Schema.Literal(
  ...NAKAFA_AGENT_SECTIONS
).annotations({
  description:
    'Public Nakafa content section: "subject" lessons and study materials, "articles" editorial/news content, "exercises" practice questions, or "quran" Quran references.',
});

/** Runtime schema for a canonical content reference used across agent tools. */
export const NakafaAgentContentRefSchema = Schema.Struct({
  content_id: NakafaAgentContentIdSchema.annotations({
    description: "Stable content identifier returned by Nakafa MCP search.",
  }),
  locale: LocaleSchema.annotations({
    description: "Locale of the referenced content.",
  }),
  markdown_url: NakafaAgentMarkdownUrlSchema.annotations({
    description: "Canonical markdown URL for focused agent retrieval.",
  }),
  route: NakafaAgentContentRouteSchema.annotations({
    description: "Locale-free route under the Nakafa content tree.",
  }),
  section: NakafaAgentSectionSchema.annotations({
    description: "Top-level Nakafa content section.",
  }),
  url: NakafaAgentContentUrlSchema.annotations({
    description: "Canonical public Nakafa URL for citation.",
  }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Canonical Nakafa agent content reference." });

/** Runtime schema for one searchable Nakafa content summary. */
export const NakafaAgentContentSummarySchema = NakafaAgentContentRefSchema.pipe(
  Schema.extend(
    Schema.Struct({
      description: Schema.String.annotations({
        description: "Short content description for search results.",
      }),
      title: Schema.String.annotations({
        description: "Human-readable content title.",
      }),
    })
  ),
  Schema.mutable
).annotations({ description: "Searchable Nakafa content summary." });

export type NakafaAgentSection = Schema.Schema.Type<
  typeof NakafaAgentSectionSchema
>;
export type NakafaAgentContentId = Schema.Schema.Type<
  typeof NakafaAgentContentIdSchema
>;
export type NakafaAgentContentRoute = Schema.Schema.Type<
  typeof NakafaAgentContentRouteSchema
>;
export type NakafaAgentContentUrl = Schema.Schema.Type<
  typeof NakafaAgentContentUrlSchema
>;
export type NakafaAgentMarkdownUrl = Schema.Schema.Type<
  typeof NakafaAgentMarkdownUrlSchema
>;
export type NakafaAgentContentRef = Schema.Schema.Type<
  typeof NakafaAgentContentRefSchema
>;
export type NakafaAgentContentSummary = Schema.Schema.Type<
  typeof NakafaAgentContentSummarySchema
>;
