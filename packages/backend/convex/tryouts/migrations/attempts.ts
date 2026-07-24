import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  loadStableSet,
  verifyStableSections,
} from "@repo/backend/convex/tryouts/snapshot/catalog";
import type { TryoutIdentityInput } from "@repo/backend/convex/tryouts/migrations/spec";
import {
  exactRows,
  identityReceipt,
  requireSet,
  validateAttemptState,
} from "@repo/backend/convex/tryouts/migrations/state";
import { Effect } from "effect";

/** Migrates one bounded attempt page after exact snapshot verification. */
export const migrateAttempts = Effect.fn("tryouts.migrations.migrateAttempts")(
  function* (ctx: MutationCtx, input: TryoutIdentityInput) {
    const rows = yield* exactRows(
      () => ctx.db.query("tryoutAttempts").take(input.expectedRows + 1),
      input.expectedRows,
      input.phase
    );
    const page = yield* Effect.promise(() =>
      ctx.db.query("tryoutAttempts").paginate(input.paginationOpts)
    );
    let candidates = 0;
    let updated = 0;
    for (const attempt of page.page) {
      const set = yield* requireSet(ctx, attempt.tryoutSetId);
      const stable = yield* loadStableSet(ctx, input.snapshotId, set);
      yield* verifyStableSections(
        ctx,
        input.snapshotId,
        stable,
        attempt.sectionSnapshots
      );
      const stateError = validateAttemptState(
        attempt,
        input.snapshotId,
        stable
      );
      if (stateError) {
        return yield* stateError;
      }
      if (attempt.tryoutSnapshotId !== undefined) {
        continue;
      }
      candidates += 1;
      if (input.apply) {
        yield* Effect.promise(() =>
          ctx.db.patch("tryoutAttempts", attempt._id, {
            countryKey: stable.countryKey,
            examKey: stable.examKey,
            locale: stable.locale,
            setIdentity: stable.identity,
            setKey: stable.setKey,
            trackKey: stable.trackKey,
            tryoutSnapshotId: input.snapshotId,
          })
        );
        updated += 1;
      }
    }
    return identityReceipt(rows.length, page, candidates, updated);
  }
);
