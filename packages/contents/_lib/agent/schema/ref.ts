import { NAKAFA_AGENT_SECTIONS } from "@repo/contents/_lib/agent/constants";
import { LocaleSchema } from "@repo/contents/_types/content";
import { Schema } from "effect";

const MARKDOWN_EXTENSION = ".md";
const ABSOLUTE_URL_PATTERN =
  /^[a-z][a-z\d+.-]*:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/i;
const NAKAFA_CONTENT_URL_PATTERN =
  /^https:\/\/(?:www\.)?nakafa\.com(\/[^\s?#]*)?(?:[?#][^\s]*)?$/;

const UrlStringSchema = Schema.String.pipe(
  Schema.filter((value) => ABSOLUTE_URL_PATTERN.test(value), {
    message: () => "Expected a valid URL.",
  })
);

/** Extracts a canonical Nakafa URL pathname for schema transformation. */
function getNakafaContentUrlPathname(value: string) {
  const match = NAKAFA_CONTENT_URL_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  return match[1] ?? "/";
}

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
 * Checks whether a string is a safe graph-backed content asset ID.
 */
function isSafeNakafaContentId(value: string) {
  const [prefix, ...segments] = value.split(":");

  if (prefix !== "asset" || segments.length < 3) {
    return false;
  }

  return segments.every(isSafeGraphIdSegment);
}

/** Checks one graph ID segment for path-safe, delimiter-safe text. */
function isSafeGraphIdSegment(segment: string) {
  return (
    segment.length > 0 &&
    !segment.includes("/") &&
    segment !== "." &&
    segment !== ".."
  );
}

/**
 * Checks whether a URL points at Nakafa's public content origin.
 */
function isNakafaContentUrl(value: string) {
  return getNakafaContentUrlPathname(value) !== null;
}

/**
 * Runtime schema for stable Nakafa content IDs returned by agent tools.
 *
 * @see https://effect.website/docs/code-style/branded-types/
 */
export const NakafaAgentContentIdSchema = Schema.String.pipe(
  Schema.filter(isSafeNakafaContentId, {
    message: () => "Expected a graph-backed Nakafa asset content ID.",
  }),
  Schema.brand("@Nakafa/AgentContentId")
).annotations({
  description: "Stable graph-backed content identifier returned by Nakafa.",
});

/** Runtime schema for stable graph IDs included in content references. */
const NakafaAgentGraphIdSchema = Schema.String.pipe(
  Schema.filter(
    (value) => {
      const [prefix, ...segments] = value.split(":");

      return (
        isSafeGraphIdSegment(prefix) &&
        segments.length > 0 &&
        segments.every(isSafeGraphIdSegment)
      );
    },
    { message: () => "Expected a safe Nakafa graph ID." }
  )
).annotations({
  description: "Stable Nakafa learning graph identifier.",
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
    (value) => {
      const pathname = getNakafaContentUrlPathname(value);

      if (!pathname) {
        return false;
      }

      return pathname.endsWith(MARKDOWN_EXTENSION);
    },
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
    'Public Nakafa content section: "material" lessons and practice assets, "articles" editorial/news content, or "quran" Quran references.',
});

/** Runtime schema for a canonical content reference used across agent tools. */
export const NakafaAgentContentRefSchema = Schema.Struct({
  alignmentId: NakafaAgentGraphIdSchema,
  assetId: NakafaAgentGraphIdSchema,
  conceptId: NakafaAgentGraphIdSchema,
  content_id: NakafaAgentContentIdSchema.annotations({
    description: "Stable content identifier returned by Nakafa MCP search.",
  }),
  learningObjectId: NakafaAgentGraphIdSchema,
  lensId: NakafaAgentGraphIdSchema,
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
