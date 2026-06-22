import type {
  NinaContextSnapshot,
  NinaLearningSessionInput,
} from "@repo/ai/nina/context";
import {
  NinaContextSnapshotSchema,
  openNinaLearningSession,
} from "@repo/ai/nina/context";
import { type Locale, LocaleSchema } from "@repo/contents/_types/content";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { LearningProgramKeySchema } from "@repo/contents/_types/program/schema";
import { readStaticPublicLearningIndex } from "@repo/contents/_types/route/learning/static";
import { readMaterialContextHint } from "@repo/contents/_types/route/material/context";
import type { PublicRoute } from "@repo/contents/_types/route/schema";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Option, Schema } from "effect";

const ClientNinaContextInputSchema = Schema.Struct({
  materialContextHint: Schema.optional(Schema.NullOr(Schema.String)),
}).pipe(Schema.mutable);

/** Route-bound facts needed to open one validated Nina learning session. */
const ResolveNinaLearningSessionInputSchema = Schema.Struct({
  capturedAt: Schema.String,
  locale: LocaleSchema,
  pinnedContext: Schema.optional(NinaContextSnapshotSchema),
  rawContext: Schema.Unknown,
  slug: Schema.String,
  url: Schema.String,
  verified: Schema.Boolean,
}).pipe(Schema.mutable);

type ClientNinaContextInput = Schema.Schema.Type<
  typeof ClientNinaContextInputSchema
>;
type ResolveNinaLearningSessionInput = Schema.Schema.Type<
  typeof ResolveNinaLearningSessionInputSchema
>;

/** Decodes the optional browser-provided Nina context payload. */
function readClientNinaContextInput(value: unknown): ClientNinaContextInput {
  const decoded = Schema.decodeUnknownOption(ClientNinaContextInputSchema)(
    value
  );

  if (Option.isNone(decoded)) {
    return {};
  }

  return decoded.value;
}

/** Returns whether a public route row owns canonical source content. */
function hasSourceContent(
  route: PublicRoute | undefined
): route is Extract<PublicRoute, { sourcePath: string }> {
  return Boolean(route && "sourcePath" in route);
}

/** Builds Nina's verified learning context from a public route projection. */
function createNinaLearningContext({
  locale,
  route,
  slug,
  url,
  verified,
}: {
  locale: Locale;
  route: PublicRoute | undefined;
  slug: string;
  url: string;
  verified: boolean;
}): NinaLearningSessionInput["learning"] {
  if (!hasSourceContent(route)) {
    return {
      locale,
      slug,
      url,
      verified,
    };
  }

  const graph = createLearningGraphIdentityFromRoute({
    locale,
    route: route.sourcePath,
  });

  return {
    assetId: graph?.assetId,
    contentId: graph?.assetId,
    locale,
    materialKey: route.materialKey,
    section: route.kind,
    slug,
    sourcePath: route.sourcePath,
    title: route.title,
    url,
    verified,
  };
}

/** Builds Nina's placement context only when the material ctx hint validates. */
function createNinaPlacementContext({
  clientContext,
  route,
}: {
  clientContext: ClientNinaContextInput;
  route: PublicRoute | undefined;
}): NinaLearningSessionInput["placement"] {
  if (!hasSourceContent(route)) {
    return;
  }

  const context = readMaterialContextHint(clientContext.materialContextHint);
  const header = readStaticPublicLearningIndex().resolveMaterialHeaderLink({
    context,
    route,
  });
  const programKey = Schema.decodeUnknownOption(LearningProgramKeySchema)(
    context?.programKey
  );

  if (!(context && header) || Option.isNone(programKey)) {
    return;
  }

  return {
    mode: "placement",
    nodeKey: context.nodeKey,
    parentHref: header.href,
    parentTitle: header.label,
    programKey: programKey.value,
  };
}

/** Builds NinaHarness input from the current app route and validated context. */
function createNinaLearningSessionInput({
  capturedAt,
  locale,
  pinnedContext,
  rawContext,
  slug,
  url,
  verified,
}: ResolveNinaLearningSessionInput): NinaLearningSessionInput {
  if (!verified && pinnedContext) {
    return createPinnedNinaLearningSessionInput({
      capturedAt,
      snapshot: pinnedContext,
    });
  }

  const cleanPath = cleanSlug(slug);
  const route = readStaticPublicLearningIndex().resolveRouteByPath(
    cleanPath,
    locale
  );
  const clientContext = readClientNinaContextInput(rawContext);
  const learning = createNinaLearningContext({
    locale,
    route,
    slug: cleanPath,
    url,
    verified,
  });
  const placement = createNinaPlacementContext({
    clientContext,
    route,
  });

  return {
    capturedAt,
    learning,
    source: "current-page",
    ...(placement ? { placement } : {}),
  };
}

/** Builds NinaHarness input from the latest stored context in an existing chat. */
function createPinnedNinaLearningSessionInput({
  capturedAt,
  snapshot,
}: {
  capturedAt: string;
  snapshot: NinaContextSnapshot;
}): NinaLearningSessionInput {
  return {
    capturedAt,
    learning: snapshot.learning,
    source: "pinned-chat",
    ...(snapshot.placement ? { placement: snapshot.placement } : {}),
  };
}

/** Resolves one Effect-native Nina learning session for the chat route. */
export const resolveNinaLearningSession = Effect.fn(
  "chat.resolveNinaLearningSession"
)(function* (input: ResolveNinaLearningSessionInput) {
  const routeInput = yield* Schema.decodeUnknown(
    ResolveNinaLearningSessionInputSchema
  )(input);

  return yield* openNinaLearningSession(
    createNinaLearningSessionInput(routeInput)
  );
});
