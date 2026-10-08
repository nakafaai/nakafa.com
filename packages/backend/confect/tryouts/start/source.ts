import {
  TryoutSectionSchema,
  TryoutSetSchema,
} from "@nakafa/aksara-contracts/tryout/catalog";
import { TryoutPlacementSchema } from "@nakafa/aksara-contracts/tryout/placement";
import tryoutRuntimeBundles from "@repo/backend/confect/_generated/tables/tryoutRuntimeBundles";
import { findReleaseTryoutRuntime } from "@repo/backend/confect/contentRelease/tryout/binding";
import type { StartAttemptArgs } from "@repo/backend/confect/tryouts/start/spec";
import { tryoutLayer } from "@repo/backend/content/tryout/confect";
import { loadTryoutOwner } from "@repo/backend/content/tryout/owner";
import { readTryoutSet } from "@repo/backend/content/tryout/set";
import { Effect, Schema } from "effect";

/** Signed rows of one verified try-out set, exactly as readTryoutSet returns them. */
const verifiedTryoutSetSchema = Schema.Struct({
  sections: Schema.Array(
    Schema.Struct({
      placements: Schema.Array(
        Schema.Struct({
          row: TryoutPlacementSchema,
          rowHash: Schema.String,
        })
      ),
      section: Schema.Struct({
        row: TryoutSectionSchema,
        rowHash: Schema.String,
      }),
      snapshotId: Schema.String,
    })
  ),
  set: Schema.Struct({
    row: TryoutSetSchema,
    rowHash: Schema.String,
  }),
  setIdentity: Schema.String,
  snapshotId: Schema.String,
});
const tryoutSnapshotSourceSchema = Schema.Struct({
  snapshot: verifiedTryoutSetSchema,
});
/** Authenticated immutable snapshot rows used by attempt-owned projections. */
export type TryoutSnapshotSource = typeof tryoutSnapshotSourceSchema.Type;
export const tryoutStartSourceSchema = Schema.Struct({
  ...tryoutSnapshotSourceSchema.fields,
  bundle: tryoutRuntimeBundles.Doc,
  releaseId: Schema.String,
});
export type TryoutStartSource = typeof tryoutStartSourceSchema.Type;

/** Loads the active signed snapshot through its explicit runtime binding. */
export const loadTryoutStartSource = Effect.fn(
  "tryouts.start.loadTryoutStartSource"
)(function* (args: StartAttemptArgs) {
  const owner = yield* loadTryoutOwner().pipe(Effect.provide(tryoutLayer));
  const snapshot = yield* readTryoutSet(args).pipe(Effect.provide(tryoutLayer));
  const { active } = owner;
  const runtime = yield* findReleaseTryoutRuntime(
    active.signed,
    active.release.tryoutRuntimeBundleHash
  );
  // The active non-null snapshot and exact runtime binding guarantee this result.
  const selected = yield* Effect.fromNullishOr(runtime.result).pipe(
    Effect.orDie
  );
  return {
    bundle: selected.stored,
    releaseId: active.releaseId,
    snapshot,
  } satisfies TryoutStartSource;
});
