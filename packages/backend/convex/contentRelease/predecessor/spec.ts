import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { Effect, Schema } from "effect";

/** Fixed quiet period required before predecessor readers can be removed. */
export const PREDECESSOR_QUIET_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Temporary predecessor routes observed independently during the cutover. */
export const PREDECESSOR_ROUTES = [
  "singular",
  "batch",
  "protected",
  "history",
] as const;
export const predecessorRouteValidator = literals(...PREDECESSOR_ROUTES);
export type PredecessorRoute = Infer<typeof predecessorRouteValidator>;

/** Durable phases of one bounded predecessor observation. */
export const predecessorPhaseValidator = literals("armed", "sealed");

/** Operator-owned identifier recorded in the migration receipt. */
export const PredecessorObservationIdSchema = Schema.String.pipe(
  Schema.check(
    Schema.isMaxLength(80),
    Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  ),
  Schema.brand("@Nakafa/PredecessorObservationId")
);
export type PredecessorObservationId =
  typeof PredecessorObservationIdSchema.Type;

/** Empty input shared by route-specific read markers. */
export const predecessorRecordArgsValidator = v.object({});
export type PredecessorRecordArgs = Infer<
  typeof predecessorRecordArgsValidator
>;

/** Exact server-owned release identity used by the temporary observer. */
export const predecessorIdentityValidator = v.object({
  manifestHash: v.string(),
  releaseId: v.string(),
  sequence: v.number(),
});
export type PredecessorIdentity = Infer<typeof predecessorIdentityValidator>;

/** Outcome of one authenticated predecessor read marker. */
export const predecessorRecordResultValidator = v.union(
  v.object({ kind: v.literal("inactive") }),
  v.object({ kind: v.literal("recorded") }),
  v.object({
    kind: v.literal("drifted"),
    live: predecessorIdentityValidator,
    stored: predecessorIdentityValidator,
  })
);
export type PredecessorRecordResult = Infer<
  typeof predecessorRecordResultValidator
>;

/** Exact observation selected by one operator control function. */
export const predecessorObservationArgsValidator = v.object({
  observationId: v.string(),
});
export type PredecessorObservationArgs = Infer<
  typeof predecessorObservationArgsValidator
>;

const predecessorRouteStatusValidator = v.object({
  armedAt: v.number(),
  invocationCount: v.number(),
  lastInvokedAt: v.optional(v.number()),
  phase: predecessorPhaseValidator,
  quietSince: v.number(),
  route: predecessorRouteValidator,
  sealedAt: v.optional(v.number()),
});

const predecessorStatusFields = {
  deploymentName: v.string(),
  observationId: v.string(),
  routes: v.object({
    batch: predecessorRouteStatusValidator,
    history: predecessorRouteStatusValidator,
    protected: predecessorRouteStatusValidator,
    singular: predecessorRouteStatusValidator,
  }),
};

/** Server-derived status for one exact observation and live release. */
export const predecessorStatusValidator = v.union(
  v.object({
    ...predecessorStatusFields,
    active: predecessorIdentityValidator,
    kind: v.literal("active"),
  }),
  v.object({
    ...predecessorStatusFields,
    kind: v.literal("drifted"),
    live: predecessorIdentityValidator,
    stored: predecessorIdentityValidator,
  })
);
export type PredecessorStatus = Infer<typeof predecessorStatusValidator>;

const predecessorAbandonFields = {
  deleted: v.literal(4),
  deploymentName: v.string(),
  observationId: v.string(),
};

/** Server-derived receipt for abandoning one release-drifted observation. */
export const predecessorAbandonReceiptValidator = v.object({
  ...predecessorAbandonFields,
  abandonedAt: v.number(),
  kind: v.literal("abandoned"),
  live: predecessorIdentityValidator,
  routes: v.object({
    batch: predecessorRouteStatusValidator,
    history: predecessorRouteStatusValidator,
    protected: predecessorRouteStatusValidator,
    singular: predecessorRouteStatusValidator,
  }),
  stored: predecessorIdentityValidator,
});
export type PredecessorAbandonReceipt = Infer<
  typeof predecessorAbandonReceiptValidator
>;

/** Decodes one operator observation identifier without accepting aliases. */
export const decodePredecessorObservationId = Effect.fn(
  "contentRelease.predecessor.decodeObservationId"
)(function* (input: string) {
  return yield* Schema.decodeEffect(PredecessorObservationIdSchema)(input).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "Predecessor observation ID is invalid.",
        })
    )
  );
});
