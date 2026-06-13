import {
  NAKAFA_BASE_URL,
  NAKAFA_MCP_INFORMATIONAL_ROOT,
} from "@repo/contents/_lib/agent/constants";
import type {
  NakafaAgentContentId,
  NakafaAgentContentRef,
  NakafaAgentSection,
} from "@repo/contents/_lib/agent/schema/ref";
import {
  NakafaAgentContentRefSchema,
  NakafaAgentContentRouteSchema,
  NakafaAgentContentUrlSchema,
  NakafaAgentMarkdownUrlSchema,
  NakafaAgentSectionSchema,
} from "@repo/contents/_lib/agent/schema/ref";
import type { Locale } from "@repo/contents/_types/content";
import { LocaleSchema } from "@repo/contents/_types/content";
import {
  createLearningGraphIdentityFromRoute,
  type LearningGraphIdentity,
} from "@repo/contents/_types/learning-graph";
import { cleanSlug } from "@repo/utilities/helper";
import { Option, Schema } from "effect";

const CONTENT_RESOURCE_PREFIX = "nakafa://content/";
const MARKDOWN_EXTENSION_PATTERN = /\.mdx?$/;

interface NakafaContentGraphProjection extends LearningGraphIdentity {
  content_id: string;
  locale: Locale;
  route: string;
  section: NakafaAgentSection;
}

/**
 * Parses a canonical Nakafa URL projection into a graph-backed content ref.
 *
 * Graph asset IDs need the backend route read model to resolve back to a route.
 * Bare routes are not accepted as product identity.
 */
export function parseNakafaContentRef(input: string) {
  if (!isNakafaUrlProjectionInput(input)) {
    return Option.none<NakafaAgentContentRef>();
  }

  const normalized = normalizeNakafaContentInput(input);
  const cleanInput = cleanSlug(
    normalized.replace(MARKDOWN_EXTENSION_PATTERN, "")
  );
  const segments = cleanInput.split("/").filter(Boolean);
  const firstSegment = segments.at(0);

  if (!firstSegment) {
    return Option.none<NakafaAgentContentRef>();
  }

  const parsedLeadingLocale =
    Schema.decodeUnknownOption(LocaleSchema)(firstSegment);
  if (Option.isNone(parsedLeadingLocale)) {
    return Option.none<NakafaAgentContentRef>();
  }

  const locale = parsedLeadingLocale.value;
  const routeSegments = segments.slice(1);
  const route = routeSegments.join("/");
  const parsedRoute = Schema.decodeUnknownOption(NakafaAgentContentRouteSchema)(
    route
  );
  const parsedSection = Schema.decodeUnknownOption(NakafaAgentSectionSchema)(
    routeSegments.at(0)
  );
  const identity = createLearningGraphIdentityFromRoute({ locale, route });

  if (Option.isNone(parsedRoute)) {
    return Option.none<NakafaAgentContentRef>();
  }

  if (Option.isNone(parsedSection)) {
    return Option.none<NakafaAgentContentRef>();
  }

  if (!identity) {
    return Option.none<NakafaAgentContentRef>();
  }

  return Option.some(
    buildNakafaContentRef(locale, parsedRoute.value, parsedSection.value)
  );
}

function isNakafaUrlProjectionInput(input: string) {
  const trimmed = input.trim();

  return (
    URL.canParse(trimmed) && normalizeNakafaContentInput(trimmed) !== trimmed
  );
}

/** Builds a canonical content reference from already-normalized route parts. */
export function buildNakafaContentRef(
  locale: Locale,
  route: string,
  section: NakafaAgentSection
) {
  const contentRoute = NakafaAgentContentRouteSchema.make(route);
  const identity = createLearningGraphIdentityFromRoute({
    locale,
    route: contentRoute,
  });

  if (!identity) {
    throw new Error(
      `Cannot build Nakafa graph content ref for ${contentRoute}.`
    );
  }

  return Schema.decodeUnknownSync(NakafaAgentContentRefSchema)(
    createNakafaContentRefInput({
      ...identity,
      content_id: identity.assetId,
      locale,
      route: contentRoute,
      section,
    })
  );
}

/**
 * Builds a canonical content reference from persisted graph route-catalog fields.
 */
export function createNakafaContentRefFromGraphProjection(
  input: NakafaContentGraphProjection
) {
  if (input.content_id !== input.assetId) {
    return Option.none<NakafaAgentContentRef>();
  }

  return Schema.decodeUnknownOption(NakafaAgentContentRefSchema)(
    createNakafaContentRefInput(input)
  );
}

function createNakafaContentRefInput(input: NakafaContentGraphProjection) {
  return {
    alignmentId: input.alignmentId,
    assetId: input.assetId,
    conceptId: input.conceptId,
    content_id: input.content_id,
    learningObjectId: input.learningObjectId,
    lensId: input.lensId,
    locale: input.locale,
    markdown_url: NakafaAgentMarkdownUrlSchema.make(
      `${NAKAFA_BASE_URL}/${input.locale}/${input.route}.md`
    ),
    route: input.route,
    section: input.section,
    url: NakafaAgentContentUrlSchema.make(
      `${NAKAFA_BASE_URL}/${input.locale}/${input.route}`
    ),
  };
}

/** Builds the MCP resource URI for a canonical Nakafa content reference. */
export function getNakafaContentResourceUri(contentId: NakafaAgentContentId) {
  return `${CONTENT_RESOURCE_PREFIX}${contentId.replaceAll("/", "%2F")}`;
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
