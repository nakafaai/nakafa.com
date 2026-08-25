import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { Effect, Schema } from "effect";

/** Fixed quiet period required before predecessor readers can be removed. */
export const PREDECESSOR_QUIET_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Temporary predecessor routes observed independently during the cutover. */
export const PREDECESSOR_ROUTES = ["singular", "batch"] as const;
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

/** Whether one authenticated predecessor read was durably recorded. */
export const predecessorRecordResultValidator = v.object({
  observed: v.boolean(),
});
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
  quietForMs: v.number(),
  quietSince: v.number(),
  readyToSeal: v.boolean(),
  route: predecessorRouteValidator,
  sealedAt: v.optional(v.number()),
});

/** Server-derived status for one exact observation and active release. */
export const predecessorStatusValidator = v.object({
  activeManifestHash: v.string(),
  activeReleaseId: v.string(),
  activeSequence: v.number(),
  checkedAt: v.number(),
  deploymentName: v.string(),
  observationId: v.string(),
  readyToSeal: v.boolean(),
  routes: v.object({
    batch: predecessorRouteStatusValidator,
    singular: predecessorRouteStatusValidator,
  }),
});
export type PredecessorStatus = Infer<typeof predecessorStatusValidator>;

/** Honest server-side receipt for deleting one sealed observation. */
export const predecessorClearReceiptValidator = v.object({
  clearedAt: v.number(),
  deleted: v.number(),
  deploymentName: v.string(),
  observationId: v.string(),
});
export type PredecessorClearReceipt = Infer<
  typeof predecessorClearReceiptValidator
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
