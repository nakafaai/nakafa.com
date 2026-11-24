import { Schema } from "effect";

/** Which learner table one re-pin page is currently scanning. */
const repinPhaseValidator = Schema.Literals(["attempts", "sessions"]);
export type RepinPhase = typeof repinPhaseValidator.Type;

/** Bounded inputs for one transactional re-pin page. */
export const repinPageArgsValidator = Schema.Struct({
  batchSize: Schema.optionalKey(Schema.Finite),
  cursor: Schema.optionalKey(Schema.NullOr(Schema.String)),
  fromSnapshotId: Schema.String,
  phase: Schema.optionalKey(repinPhaseValidator),
});
export type RepinPageArgs = typeof repinPageArgsValidator.Type;

/** Bounded inputs for the internal action that drives multiple re-pin pages. */
export const repinRunArgsValidator = Schema.Struct({
  batchSize: Schema.optionalKey(Schema.Finite),
  fromSnapshotId: Schema.String,
  maxPages: Schema.optionalKey(Schema.Finite),
});
export type RepinRunArgs = typeof repinRunArgsValidator.Type;

/** Cumulative outcome reported by one re-pin page or action run. */
export const repinReceiptValidator = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  done: Schema.Boolean,
  phase: repinPhaseValidator,
  repinnedAttempts: Schema.Finite,
  repinnedSessions: Schema.Finite,
  skippedAttempts: Schema.Finite,
  skippedSessions: Schema.Finite,
  targetSnapshotId: Schema.String,
});
export type RepinReceipt = typeof repinReceiptValidator.Type;
