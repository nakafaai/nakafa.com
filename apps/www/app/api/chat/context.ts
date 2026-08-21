import type {
  NinaContextSnapshot,
  NinaLearningSessionInput,
} from "@repo/ai/nina/memory/pack";
import {
  NinaContextSnapshotSchema,
  openNinaLearningSession,
} from "@repo/ai/nina/memory/pack";
import { LocaleSchema } from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Option, Schema, Struct } from "effect";
import {
  isPublishedMaterialPath,
  readPublishedNinaMaterial,
} from "@/app/api/chat/published";

const ClientNinaContextInputSchema = Schema.Struct({
  materialContextHint: Schema.optional(Schema.NullOr(Schema.String)),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
/** Route-bound facts needed to open one validated Nina learning session. */
const ResolveNinaLearningSessionInputSchema = Schema.Struct({
  capturedAt: Schema.String,
  locale: LocaleSchema,
  pinnedContext: Schema.optional(NinaContextSnapshotSchema),
  rawContext: Schema.Unknown,
  slug: Schema.String,
  url: Schema.String,
  verified: Schema.Boolean,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
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
/** Builds NinaHarness input from the current verified publication owner. */
const createNinaLearningSessionInput = Effect.fn(
  "chat.createNinaLearningSessionInput"
)(function* ({
  capturedAt,
  locale,
  pinnedContext,
  rawContext,
  slug,
  url,
  verified,
}: ResolveNinaLearningSessionInput) {
  if (!verified && pinnedContext) {
    return createPinnedNinaLearningSessionInput({
      capturedAt,
      snapshot: pinnedContext,
    });
  }
  const cleanPath = cleanSlug(slug);
  const clientContext = readClientNinaContextInput(rawContext);
  if (verified && isPublishedMaterialPath(locale, cleanPath)) {
    const published = yield* readPublishedNinaMaterial({
      contextHint: clientContext.materialContextHint,
      locale,
      publicPath: cleanPath,
      url,
    });
    return {
      capturedAt,
      learning: published.learning,
      source: "current-page",
      ...(published.placement ? { placement: published.placement } : {}),
    } satisfies NinaLearningSessionInput;
  }
  return {
    capturedAt,
    learning: {
      locale,
      slug: cleanPath,
      url,
      verified,
    },
    source: "current-page",
  } satisfies NinaLearningSessionInput;
});
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
  const routeInput = yield* Schema.decodeEffect(
    ResolveNinaLearningSessionInputSchema
  )(input);
  const sessionInput = yield* createNinaLearningSessionInput(routeInput);
  return yield* openNinaLearningSession(sessionInput);
});
