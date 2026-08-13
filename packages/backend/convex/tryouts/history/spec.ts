import { v } from "convex/values";
import { Effect, Schema } from "effect";

export interface RetainedTryoutRelease {
  readonly attemptCount: number;
  readonly manifestHash: string;
  readonly releaseId: string;
}

/** Exact immutable production inventory accepted by the Phase 1a cutover. */
export interface RetainedTryoutHistoryPlan {
  readonly artifactCount: number;
  readonly attemptCount: number;
  readonly catalogRowCount: number;
  readonly firstCatalogIndex: number;
  readonly firstPlacementIndex: number;
  readonly format: "tryout-v1";
  readonly frozenPlacementCount: number;
  readonly placementRowCount: number;
  readonly progressCount: number;
  readonly releases: readonly RetainedTryoutRelease[];
  readonly snapshotId: string;
}

/** Production identities proven by the read-only retained-attempt audit. */
export const retainedTryoutHistoryPlan = {
  artifactCount: 1680,
  attemptCount: 21,
  catalogRowCount: 54,
  firstCatalogIndex: 0,
  firstPlacementIndex: 54,
  format: "tryout-v1",
  frozenPlacementCount: 1720,
  placementRowCount: 840,
  progressCount: 10,
  releases: [
    {
      attemptCount: 15,
      manifestHash:
        "sha256:fd9651a3d53c3e1db59f25f5f292683e916ed213476f51dd164a5f7531f4f6e4",
      releaseId: "quran-tryout-cutover-20260804-a48d644",
    },
    {
      attemptCount: 6,
      manifestHash:
        "sha256:b95214e55438f4d318cb0810426b605d7cde1449bafa658ab521c4a1df5b2697",
      releaseId: "full-corpus-runtime-v011-20260809-16a7436",
    },
  ],
  snapshotId:
    "sha256:0a43a4125fc4886f90b5a509405178bfb8762ad3c7f72be80614fce2671b5162",
} satisfies RetainedTryoutHistoryPlan;

/** Typed, fail-closed error for the one retained history cutover. */
export class TryoutHistoryError extends Schema.TaggedError<TryoutHistoryError>()(
  "TryoutHistoryError",
  {
    code: Schema.Literal(
      "TRYOUT_HISTORY_CONFLICT",
      "TRYOUT_HISTORY_INTEGRITY",
      "TRYOUT_HISTORY_NOT_READY",
      "TRYOUT_HISTORY_READ_FAILED",
      "TRYOUT_HISTORY_WRITE_FAILED"
    ),
    message: Schema.String,
  }
) {}

/** Creates one integrity failure for mapping another typed decoder error. */
export function historyIntegrity(message: string) {
  return new TryoutHistoryError({
    code: "TRYOUT_HISTORY_INTEGRITY",
    message,
  });
}

/** Fails one retained-history invariant without throwing. */
export function historyFail(code: TryoutHistoryError["code"], message: string) {
  return Effect.fail(new TryoutHistoryError({ code, message }));
}

/** Lifts one Convex read into the retained-history failure channel. */
export function historyRead<A>(message: string, operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: () =>
      new TryoutHistoryError({
        code: "TRYOUT_HISTORY_READ_FAILED",
        message,
      }),
    try: operation,
  });
}

/** Lifts one Convex write into the retained-history failure channel. */
export function historyWrite<A>(message: string, operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: () =>
      new TryoutHistoryError({
        code: "TRYOUT_HISTORY_WRITE_FAILED",
        message,
      }),
    try: operation,
  });
}

/** Bounded snapshot-copy progress returned to the operator. */
export const historyCopyReceiptValidator = v.object({
  created: v.number(),
  done: v.boolean(),
  nextIndex: v.number(),
  processed: v.number(),
  unchanged: v.number(),
});

/** Exact retained inventory authenticated before cutover writes. */
export const historyAuditValidator = v.object({
  attempts: v.number(),
  bundles: v.number(),
  frozenPlacements: v.number(),
  progressRows: v.number(),
  snapshotId: v.string(),
});

/** Bounded app-locale copy progress. */
export const historyLocaleReceiptValidator = v.object({
  done: v.boolean(),
  nextCursor: v.union(v.string(), v.null()),
  processed: v.number(),
  target: v.union(v.literal("attempt"), v.literal("progress")),
  updated: v.number(),
});

/** Final Phase 1a readiness evidence, without deleting legacy fields. */
export const historyReadinessValidator = v.object({
  attempts: v.number(),
  catalogRows: v.number(),
  frozenPlacements: v.number(),
  markers: v.number(),
  placementRows: v.number(),
  progressRows: v.number(),
  snapshotId: v.string(),
});
