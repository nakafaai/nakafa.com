import {
  NAKAFA_BASE_URL,
  NAKAFA_MCP_INFORMATIONAL_ROOT,
} from "@repo/contents/_lib/agent/constants";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import {
  NakafaAgentContentRefSchema,
  NakafaAgentContentRouteSchema,
  NakafaAgentContentUrlSchema,
  NakafaAgentMarkdownUrlSchema,
  NakafaAgentSectionSchema,
} from "@repo/contents/_lib/agent/schema/ref";
import type { Locale } from "@repo/contents/_types/content";
import { LocaleSchema } from "@repo/contents/_types/content";
import { LearningGraphIdentitySchema } from "@repo/contents/_types/learning-graph";
import { cleanSlug } from "@repo/utilities/helper";
import { Option, Schema } from "effect";

const CONTENT_RESOURCE_PREFIX = "nakafa://content/";
const MARKDOWN_EXTENSION_PATTERN = /\.mdx?$/;

/** Runtime schema for persisted graph projection fields accepted by agent refs. */
const NakafaContentGraphProjectionSchema = LearningGraphIdentitySchema.pipe(
  Schema.extend(
    Schema.Struct({
      content_id: Schema.String,
      locale: LocaleSchema,
      route: Schema.String,
      section: NakafaAgentSectionSchema,
      sourcePath: Schema.optional(Schema.String),
    })
  )
);

/** Persisted graph projection fields derived from the runtime schema. */
type NakafaContentGraphProjection = Schema.Schema.Type<
  typeof NakafaContentGraphProjectionSchema
>;

interface NakafaContentRefInput extends NakafaContentGraphProjection {
  publicRoute: string;
}

interface NakafaUrlRoute {
  locale: Locale;
  route: string;
}

/** Parses a Nakafa URL into locale and route without assuming source shape. */
export function parseNakafaUrlRoute(input: string) {
  if (!isNakafaUrlProjectionInput(input)) {
    return Option.none<NakafaUrlRoute>();
  }

  const normalized = normalizeNakafaContentInput(input);
  const cleanInput = cleanSlug(
    normalized.replace(MARKDOWN_EXTENSION_PATTERN, "")
  );
  const segments = cleanInput.split("/").filter(Boolean);
  const firstSegment = segments.at(0);

  if (!firstSegment) {
    return Option.none<NakafaUrlRoute>();
  }

  const parsedLocale = Schema.decodeUnknownOption(LocaleSchema)(firstSegment);
  if (Option.isNone(parsedLocale)) {
    return Option.none<NakafaUrlRoute>();
  }

  const route = segments.slice(1).join("/");
  const parsedRoute = Schema.decodeUnknownOption(NakafaAgentContentRouteSchema)(
    route
  );

  if (Option.isNone(parsedRoute)) {
    return Option.none<NakafaUrlRoute>();
  }

  return Option.some({
    locale: parsedLocale.value,
    route: parsedRoute.value,
  });
}

/** Returns whether an input is a canonical Nakafa URL or content resource ref. */
function isNakafaUrlProjectionInput(input: string) {
  const trimmed = input.trim();

  return (
    URL.canParse(trimmed) && normalizeNakafaContentInput(trimmed) !== trimmed
  );
}

/**
 * Builds a canonical content reference from persisted graph route-catalog fields.
 */
export function createNakafaContentRefFromGraphProjection(input: unknown) {
  const projection = Schema.decodeUnknownOption(
    NakafaContentGraphProjectionSchema
  )(input);

  if (Option.isNone(projection)) {
    return Option.none<NakafaAgentContentRef>();
  }

  const graph = projection.value;

  if (graph.content_id !== graph.assetId) {
    return Option.none<NakafaAgentContentRef>();
  }

  const sourceRoute = graph.sourcePath ?? graph.route;

  return Schema.decodeUnknownOption(NakafaAgentContentRefSchema)(
    createNakafaContentRefInput({
      ...graph,
      publicRoute: graph.route,
      route: sourceRoute,
    })
  );
}

/** Builds the schema-decoded agent content ref from graph projection fields. */
function createNakafaContentRefInput(input: NakafaContentRefInput) {
  return {
    alignmentId: input.alignmentId,
    assetId: input.assetId,
    conceptId: input.conceptId,
    content_id: input.content_id,
    learningObjectId: input.learningObjectId,
    lensId: input.lensId,
    locale: input.locale,
    markdown_url: NakafaAgentMarkdownUrlSchema.make(
      `${NAKAFA_BASE_URL}/${input.locale}/${input.publicRoute}.md`
    ),
    route: input.route,
    section: input.section,
    url: NakafaAgentContentUrlSchema.make(
      `${NAKAFA_BASE_URL}/${input.locale}/${input.publicRoute}`
    ),
  };
}

/** Normalizes Nakafa URLs and custom resource URIs into lookup strings. */
export function normalizeNakafaContentInput(input: string) {
  const trimmed = input.trim();

  if (trimmed.startsWith(CONTENT_RESOURCE_PREFIX)) {
    return trimmed
      .slice(CONTENT_RESOURCE_PREFIX.length)
      .replaceAll("%2F", "/")
      .replaceAll("%2f", "/");
  }

  if (!URL.canParse(trimmed)) {
    return trimmed;
  }

  const url = new URL(trimmed);
  if (
    url.hostname === "nakafa.com" ||
    url.hostname === "www.nakafa.com" ||
    url.origin === NAKAFA_MCP_INFORMATIONAL_ROOT
  ) {
    return url.pathname;
  }

  return trimmed;
}
