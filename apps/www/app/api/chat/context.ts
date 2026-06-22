import type { NinaLearningSessionInput } from "@repo/ai/nina/context";
import { openNinaLearningSession } from "@repo/ai/nina/context";
import type { Locale } from "@repo/contents/_types/content";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { readStaticPublicLearningIndex } from "@repo/contents/_types/route/learning/static";
import { readMaterialContextHint } from "@repo/contents/_types/route/material/context";
import type { PublicRoute } from "@repo/contents/_types/route/schema";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Option, Schema } from "effect";

const ClientNinaContextInputSchema = Schema.Struct({
  materialContextHint: Schema.optional(Schema.NullOr(Schema.String)),
}).pipe(Schema.mutable);

/** Route-bound facts needed to open one validated Nina learning session. */
interface ResolveNinaLearningSessionInput {
  capturedAt: string;
  locale: Locale;
  rawContext: unknown;
  slug: string;
  url: string;
  verified: boolean;
}

type ClientNinaContextInput = Schema.Schema.Type<
  typeof ClientNinaContextInputSchema
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

  if (!(context && header)) {
    return;
  }

  return {
    mode: "placement",
    nodeKey: context.nodeKey,
    parentHref: header.href,
    parentTitle: header.label,
    programKey: context.programKey,
  };
}

/** Builds NinaHarness input from the current app route and validated context. */
function createNinaLearningSessionInput({
  capturedAt,
  locale,
  rawContext,
  slug,
  url,
  verified,
}: ResolveNinaLearningSessionInput): NinaLearningSessionInput {
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
    placement,
    source: "current-page",
  };
}

/** Resolves one Effect-native Nina learning session for the chat route. */
export const resolveNinaLearningSession = Effect.fn(
  "chat.resolveNinaLearningSession"
)(function* (input: ResolveNinaLearningSessionInput) {
  return yield* openNinaLearningSession(createNinaLearningSessionInput(input));
});
