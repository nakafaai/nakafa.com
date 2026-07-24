import {
  internalMutation,
  type MutationCtx,
} from "@repo/backend/convex/_generated/server";
import { loadActiveSnapshot } from "@repo/backend/convex/contentRelease/runtime/snapshot";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { migrateAttempts } from "@repo/backend/convex/tryouts/migrations/attempts";
import { migratePlacements } from "@repo/backend/convex/tryouts/migrations/placements";
import { migrateProgress } from "@repo/backend/convex/tryouts/migrations/progress";
import {
  identityFailure,
  type TryoutIdentityInput,
  tryoutIdentityLimit,
  tryoutIdentityPageSize,
  tryoutIdentityPhases,
} from "@repo/backend/convex/tryouts/migrations/spec";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const phaseValidator = v.union(
  ...tryoutIdentityPhases.map((phase) => v.literal(phase))
);

/** Runs one exact resumable phase of the stable try-out identity migration. */
export const migrateTryoutIdentity = Effect.fn(
  "tryouts.migrations.migrateTryoutIdentity"
)(function* (ctx: MutationCtx, input: TryoutIdentityInput) {
  const maximum = tryoutIdentityLimit(input.phase);
  if (
    !Number.isSafeInteger(input.expectedRows) ||
    input.expectedRows < 0 ||
    input.expectedRows > maximum
  ) {
    return yield* identityFailure(
      "TRYOUT_IDENTITY_EXPECTATION_INVALID",
      `Expected ${input.phase} count must be a safe integer from 0-${maximum}.`
    );
  }
  if (input.paginationOpts.numItems !== tryoutIdentityPageSize) {
    return yield* identityFailure(
      "TRYOUT_IDENTITY_PAGE_INVALID",
      `Migration page size must be exactly ${tryoutIdentityPageSize}.`
    );
  }
  const active = yield* loadActiveSnapshot(ctx, "tryout");
  if (!active || active.snapshotId !== input.snapshotId) {
    return yield* identityFailure(
      "TRYOUT_IDENTITY_SNAPSHOT_INACTIVE",
      `Snapshot ${input.snapshotId} is not the verified active try-out snapshot.`
    );
  }
  if (input.phase === "attempts") {
    return yield* migrateAttempts(ctx, input);
  }
  if (input.phase === "progress") {
    return yield* migrateProgress(ctx, input);
  }
  return yield* migratePlacements(ctx, input);
});

/** Exposes the guarded migration through an internal operator-only mutation. */
export const migrate = internalMutation({
  args: {
    apply: v.boolean(),
    expectedRows: v.number(),
    paginationOpts: paginationOptsValidator,
    phase: phaseValidator,
    snapshotId: v.string(),
  },
  handler: (ctx, args) => runConvexProgram(migrateTryoutIdentity(ctx, args)),
  returns: v.object({
    candidates: v.number(),
    continueCursor: v.string(),
    isDone: v.boolean(),
    processed: v.number(),
    updated: v.number(),
  }),
});
