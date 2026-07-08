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
import { getSourceRouteProjectionForRoute } from "@repo/contents/_types/graph/projection";
import { InvalidLearningGraphRouteError } from "@repo/contents/_types/graph/schema";
import {
  createLearningGraphIdentityFromProjection,
  LearningGraphIdentitySchema,
} from "@repo/contents/_types/learning-graph";
import { findPublicRouteByPath } from "@repo/contents/_types/route/projection";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Option, Schema } from "effect";

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
  publicRoute?: string;
}

interface NakafaUrlRoute {
  locale: Locale;
  route: string;
}

/**
 * Parses a canonical Nakafa URL projection into a graph-backed content ref.
 *
 * Graph asset IDs need the backend route read model to resolve back to a route.
 * Bare routes are not accepted as product identity.
 */
export function parseNakafaContentRef(input: string) {
  const parsed = parseNakafaUrlRoute(input);
  if (Option.isNone(parsed)) {
    return Option.none<NakafaAgentContentRef>();
  }

  return createNakafaSourceContentRef(parsed.value.locale, parsed.value.route);
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

/** Resolves public material URLs through route projection first. */
export const resolveNakafaContentRef = Effect.fn(
  "contents.agent.parseContentRef"
)(function* (input: string) {
  const parsed = parseNakafaUrlRoute(input);

  if (Option.isNone(parsed)) {
    return Option.none<NakafaAgentContentRef>();
  }

  const publicRoute = yield* findPublicRouteByPath(
    parsed.value.route,
    parsed.value.locale
  );

  if (Option.isSome(publicRoute)) {
    const route = publicRoute.value;

    if (route.kind === "subject-lesson" || route.kind === "subject-topic") {
      return createNakafaContentRefFromSourceRoute({
        locale: parsed.value.locale,
        publicRoute: route.publicPath,
        route: route.sourcePath,
        section: "material",
      });
    }

    return Option.none<NakafaAgentContentRef>();
  }

  return createNakafaSourceContentRef(parsed.value.locale, parsed.value.route);
});

/** Builds a graph-backed ref from a route that already belongs to source identity. */
function createNakafaSourceContentRef(locale: Locale, route: string) {
  const projection = getSourceRouteProjectionForRoute(route);

  if (!projection) {
    return Option.none<NakafaAgentContentRef>();
  }

  return createNakafaContentRef(locale, route, projection.sourceRoot);
}

/** Returns whether an input is a canonical Nakafa URL or content resource ref. */
function isNakafaUrlProjectionInput(input: string) {
  const trimmed = input.trim();

  return (
    URL.canParse(trimmed) && normalizeNakafaContentInput(trimmed) !== trimmed
  );
}

/** Builds a canonical content reference from already-normalized route parts. */
export function createNakafaContentRef(
  locale: Locale,
  route: string,
  section: NakafaAgentSection
) {
  return createNakafaContentRefFromSourceRoute({ locale, route, section });
}

/** Builds a canonical content reference from source route parts. */
function createNakafaContentRefFromSourceRoute({
  locale,
  publicRoute,
  route,
  section,
}: {
  locale: Locale;
  publicRoute?: string;
  route: string;
  section: NakafaAgentSection;
}) {
  const parsedRoute = Schema.decodeUnknownOption(NakafaAgentContentRouteSchema)(
    route
  );

  if (Option.isNone(parsedRoute)) {
    return Option.none<NakafaAgentContentRef>();
  }

  const contentRoute = parsedRoute.value;
  const projection = getSourceRouteProjectionForRoute(contentRoute);

  if (!projection) {
    return Option.none<NakafaAgentContentRef>();
  }

  if (section !== projection.sourceRoot) {
    return Option.none<NakafaAgentContentRef>();
  }

  const identity = createLearningGraphIdentityFromProjection({
    locale,
    projection,
  });

  return Schema.decodeUnknownOption(NakafaAgentContentRefSchema)(
    createNakafaContentRefInput({
      ...identity,
      content_id: identity.assetId,
      locale,
      publicRoute,
      route: contentRoute,
      section,
    })
  );
}

/** Parses a canonical content reference with a typed graph route failure. */
export const parseNakafaContentRefFields = Effect.fn(
  "contents.agent.parseNakafaContentRefFields"
)(function* (locale: Locale, route: string, section: NakafaAgentSection) {
  const ref = createNakafaContentRef(locale, route, section);

  if (Option.isSome(ref)) {
    return ref.value;
  }

  return yield* Effect.fail(
    new InvalidLearningGraphRouteError({
      message: `Cannot build Nakafa graph content ref for ${route}.`,
      route,
    })
  );
});

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
  const publicRoute = input.publicRoute ?? input.route;

  return {
    alignmentId: input.alignmentId,
    assetId: input.assetId,
    conceptId: input.conceptId,
    content_id: input.content_id,
    learningObjectId: input.learningObjectId,
    lensId: input.lensId,
    locale: input.locale,
    markdown_url: NakafaAgentMarkdownUrlSchema.make(
      `${NAKAFA_BASE_URL}/${input.locale}/${publicRoute}.md`
    ),
    route: input.route,
    section: input.section,
    url: NakafaAgentContentUrlSchema.make(
      `${NAKAFA_BASE_URL}/${input.locale}/${publicRoute}`
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
