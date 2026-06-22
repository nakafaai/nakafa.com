import { LocaleSchema } from "@repo/contents/_types/content";
import { Effect, Schema } from "effect";

export const NINA_CONTEXT_TRANSITION_REASONS = [
  "same-context",
  "page-context",
] as const;

export const NINA_CONTEXT_SOURCES = [
  "current-page",
  "pinned-chat",
  "message",
] as const;

/** Page identity Nina can trust because the app validated it before the turn. */
export const NinaLearningContextSchema = Schema.Struct({
  assetId: Schema.optional(Schema.String),
  contentId: Schema.optional(Schema.String),
  locale: LocaleSchema,
  materialKey: Schema.optional(Schema.String),
  section: Schema.optional(Schema.String),
  slug: Schema.String,
  sourcePath: Schema.optional(Schema.String),
  title: Schema.optional(Schema.String),
  url: Schema.String,
  verified: Schema.Boolean,
}).pipe(Schema.mutable);

/** Verified placement that explains why this asset was opened from navigation. */
export const LearningPlacementContextSchema = Schema.Struct({
  mode: Schema.Literal("placement"),
  nodeKey: Schema.String,
  parentHref: Schema.String,
  parentTitle: Schema.String,
  programKey: Schema.String,
}).pipe(Schema.mutable);

/** Tool permissions for a Nina turn, separated from tool implementation code. */
export const NinaToolContextSchema = Schema.Struct({
  allowDeepResearch: Schema.Boolean,
  allowMath: Schema.Boolean,
  allowNakafa: Schema.Boolean,
  allowPageFetch: Schema.Boolean,
  evidenceScope: Schema.Literal("verified-page", "general-learning"),
}).pipe(Schema.mutable);

/** Compact context copy that can be stored on messages and replayed later. */
export const NinaContextSnapshotSchema = Schema.Struct({
  learning: NinaLearningContextSchema,
  placement: Schema.optional(LearningPlacementContextSchema),
  capturedAt: Schema.String,
  source: Schema.Literal(...NINA_CONTEXT_SOURCES),
  tools: NinaToolContextSchema,
}).pipe(Schema.mutable);

/** Explicit marker for messages that intentionally switch Nina context. */
export const NinaContextTransitionSchema = Schema.Struct({
  fromContextKey: Schema.optional(Schema.String),
  reason: Schema.Literal(...NINA_CONTEXT_TRANSITION_REASONS),
  toContextKey: Schema.String,
}).pipe(Schema.mutable);

/** Input accepted by NinaHarness when opening one learning chat turn. */
export const NinaLearningSessionInputSchema = Schema.Struct({
  capturedAt: Schema.String,
  learning: NinaLearningContextSchema,
  placement: Schema.optional(LearningPlacementContextSchema),
  source: Schema.Literal(...NINA_CONTEXT_SOURCES),
}).pipe(Schema.mutable);

export type NinaLearningContext = Schema.Schema.Type<
  typeof NinaLearningContextSchema
>;
export type LearningPlacementContext = Schema.Schema.Type<
  typeof LearningPlacementContextSchema
>;
export type NinaToolContext = Schema.Schema.Type<typeof NinaToolContextSchema>;
export type NinaContextSnapshot = Schema.Schema.Type<
  typeof NinaContextSnapshotSchema
>;
export type NinaContextTransition = Schema.Schema.Type<
  typeof NinaContextTransitionSchema
>;
export type NinaLearningSessionInput = Schema.Schema.Type<
  typeof NinaLearningSessionInputSchema
>;

/** Nina context pack consumed by prompts, specialists, and message metadata. */
export interface NinaContextPack {
  readonly learning: NinaLearningContext;
  readonly placement?: LearningPlacementContext;
  readonly snapshot: NinaContextSnapshot;
  readonly tools: NinaToolContext;
  readonly transition: NinaContextTransition;
}

/** NinaHarness output returned to app route boundaries for one turn. */
export interface NinaLearningSession {
  readonly context: NinaContextPack;
}

/** Raised when the app boundary sends an invalid Nina learning context. */
export class NinaContextError extends Schema.TaggedError<NinaContextError>()(
  "NinaContextError",
  {
    message: Schema.String,
  }
) {}

/** Creates the stable key used for context snapshots and transition markers. */
export function createNinaContextKey({
  learning,
  placement,
}: {
  readonly learning: NinaLearningContext;
  readonly placement?: LearningPlacementContext;
}) {
  if (placement) {
    return `placement:${placement.programKey}:${placement.nodeKey}:${learning.slug}`;
  }

  return `canonical:${learning.slug}`;
}

/** Resolves per-turn specialist evidence permissions from validated context. */
export function resolveNinaToolContext(
  learning: NinaLearningContext
): NinaToolContext {
  const allowPageFetch = learning.verified;

  return {
    allowDeepResearch: true,
    allowMath: true,
    allowNakafa: true,
    allowPageFetch,
    evidenceScope: allowPageFetch ? "verified-page" : "general-learning",
  };
}

/** Builds the durable snapshot that survives chat reload and retries. */
export function createNinaContextSnapshot({
  capturedAt,
  learning,
  placement,
  source,
  tools,
}: {
  readonly capturedAt: string;
  readonly learning: NinaLearningContext;
  readonly placement?: LearningPlacementContext;
  readonly source: NinaContextSnapshot["source"];
  readonly tools: NinaToolContext;
}): NinaContextSnapshot {
  return {
    capturedAt,
    learning,
    placement,
    source,
    tools,
  };
}

/** Builds an explicit transition marker for the current Nina turn. */
export function createNinaContextTransition({
  learning,
  placement,
  reason,
}: {
  readonly learning: NinaLearningContext;
  readonly placement?: LearningPlacementContext;
  readonly reason: NinaContextTransition["reason"];
}): NinaContextTransition {
  return {
    reason,
    toContextKey: createNinaContextKey({ learning, placement }),
  };
}

/** Opens one validated Nina learning session as an Effect-native program. */
export const openNinaLearningSession = Effect.fn(
  "nina.openNinaLearningSession"
)(function* (input: unknown) {
  const sessionInput = yield* Schema.decodeUnknown(
    NinaLearningSessionInputSchema
  )(input).pipe(
    Effect.mapError(
      () =>
        new NinaContextError({
          message: "Invalid Nina learning session input.",
        })
    )
  );
  const tools = resolveNinaToolContext(sessionInput.learning);
  const snapshot = createNinaContextSnapshot({
    capturedAt: sessionInput.capturedAt,
    learning: sessionInput.learning,
    placement: sessionInput.placement,
    source: sessionInput.source,
    tools,
  });
  const transition = createNinaContextTransition({
    learning: sessionInput.learning,
    placement: sessionInput.placement,
    reason:
      sessionInput.source === "pinned-chat" ? "same-context" : "page-context",
  });

  return {
    context: {
      learning: sessionInput.learning,
      placement: sessionInput.placement,
      snapshot,
      tools,
      transition,
    },
  };
});
