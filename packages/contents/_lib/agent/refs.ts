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
  NakafaAgentContentIdSchema,
  NakafaAgentContentRouteSchema,
  NakafaAgentContentUrlSchema,
  NakafaAgentMarkdownUrlSchema,
  NakafaAgentSectionSchema,
} from "@repo/contents/_lib/agent/schema/ref";
import type { Locale } from "@repo/contents/_types/content";
import { LocaleSchema } from "@repo/contents/_types/content";
import { routing } from "@repo/internationalization/src/routing";
import { cleanSlug } from "@repo/utilities/helper";
import { Option, Schema } from "effect";

const CONTENT_RESOURCE_PREFIX = "nakafa://content/";
const MARKDOWN_EXTENSION_PATTERN = /\.mdx?$/;

/** Parses a content ID, Nakafa URL, or resource URI into a canonical reference. */
export function parseNakafaContentRef(
  input: string,
  fallbackLocale: Locale = routing.defaultLocale
) {
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
  const locale = Option.getOrElse(parsedLeadingLocale, () => fallbackLocale);
  const routeSegments = Option.isSome(parsedLeadingLocale)
    ? segments.slice(1)
    : segments;
  const route = routeSegments.join("/");
  const parsedRoute = Schema.decodeUnknownOption(NakafaAgentContentRouteSchema)(
    route
  );
  const parsedSection = Schema.decodeUnknownOption(NakafaAgentSectionSchema)(
    routeSegments.at(0)
  );

  if (Option.isNone(parsedRoute)) {
    return Option.none<NakafaAgentContentRef>();
  }

  if (Option.isNone(parsedSection)) {
    return Option.none<NakafaAgentContentRef>();
  }

  return Option.some(
    buildNakafaContentRef(locale, parsedRoute.value, parsedSection.value)
  );
}

/** Builds a canonical content reference from already-normalized route parts. */
export function buildNakafaContentRef(
  locale: Locale,
  route: string,
  section: NakafaAgentSection
) {
  const contentRoute = NakafaAgentContentRouteSchema.make(route);
  const contentId = NakafaAgentContentIdSchema.make(
    `${locale}/${contentRoute}`
  );
  const contentRef = {
    content_id: contentId,
    locale,
    markdown_url: NakafaAgentMarkdownUrlSchema.make(
      `${NAKAFA_BASE_URL}/${contentId}.md`
    ),
    route: contentRoute,
    section,
    url: NakafaAgentContentUrlSchema.make(`${NAKAFA_BASE_URL}/${contentId}`),
  };

  return contentRef;
}

/** Builds the MCP resource URI for a canonical Nakafa content reference. */
export function getNakafaContentResourceUri(contentId: NakafaAgentContentId) {
  return `${CONTENT_RESOURCE_PREFIX}${contentId.replaceAll("/", "%2F")}`;
}

/** Normalizes Nakafa URLs and custom resource URIs into content IDs. */
function normalizeNakafaContentInput(input: string) {
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
