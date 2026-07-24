import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  identityFailure,
  type TryoutIdentityInput,
} from "@repo/backend/convex/tryouts/migrations/spec";
import {
  exactRows,
  identityReceipt,
  requireSet,
  requireStableAttempt,
} from "@repo/backend/convex/tryouts/migrations/state";
import { loadStableSet } from "@repo/backend/convex/tryouts/snapshot/catalog";
import { Effect } from "effect";

/** Rejects progress rows that would collapse onto one stable user/set key. */
const validateStableProgressKeys = Effect.fn(
  "tryouts.migrations.validateStableProgressKeys"
)(function* (
  ctx: MutationCtx,
  snapshotId: string,
  rows: readonly Doc<"tryoutSetProgress">[]
) {
  const stableKeys = new Set<string>();
  for (const progress of rows) {
    const set = yield* requireSet(ctx, progress.tryoutSetId);
    const stable = yield* loadStableSet(ctx, snapshotId, set);
    const stableKey = `${progress.userId}:${stable.identity}`;
    if (stableKeys.has(stableKey)) {
      return yield* identityFailure(
        "TRYOUT_IDENTITY_PROGRESS_DUPLICATE",
        `Progress ${progress._id} duplicates one stable user/set identity.`
      );
    }
    stableKeys.add(stableKey);
  }
});

/** Migrates one bounded user-progress page to the stable set identity. */
export const migrateProgress = Effect.fn("tryouts.migrations.migrateProgress")(
  function* (ctx: MutationCtx, input: TryoutIdentityInput) {
    const rows = yield* exactRows(
      () => ctx.db.query("tryoutSetProgress").take(input.expectedRows + 1),
      input.expectedRows,
      input.phase
    );
    yield* validateStableProgressKeys(ctx, input.snapshotId, rows);
    const page = yield* Effect.promise(() =>
      ctx.db.query("tryoutSetProgress").paginate(input.paginationOpts)
    );
    let candidates = 0;
    let updated = 0;
    for (const progress of page.page) {
      const [set, attempt] = yield* Effect.all([
        requireSet(ctx, progress.tryoutSetId),
        Effect.promise(() => ctx.db.get(progress.latestAttemptId)),
      ]);
      if (
        !attempt ||
        attempt.tryoutSetId !== progress.tryoutSetId ||
        attempt.userId !== progress.userId
      ) {
        return yield* identityFailure(
          "TRYOUT_IDENTITY_PROGRESS_INVALID",
          `Progress ${progress._id} does not reference its own latest attempt.`
        );
      }
      const stable = yield* loadStableSet(ctx, input.snapshotId, set);
      const attemptError = requireStableAttempt(
        attempt,
        input.snapshotId,
        stable
      );
      if (attemptError) {
        return yield* attemptError;
      }
      if (
        progress.countryKey !== stable.countryKey ||
        progress.examKey !== stable.examKey ||
        progress.trackKey !== stable.trackKey ||
        progress.setKey !== stable.setKey ||
        progress.locale !== stable.locale
      ) {
        return yield* identityFailure(
          "TRYOUT_IDENTITY_PROGRESS_ROUTE_CONFLICT",
          `Progress ${progress._id} differs from its canonical set route.`
        );
      }
      if (
        progress.setIdentity !== undefined &&
        progress.setIdentity !== stable.identity
      ) {
        return yield* identityFailure(
          "TRYOUT_IDENTITY_PROGRESS_CONFLICT",
          `Progress ${progress._id} has a conflicting stable set identity.`
        );
      }
      if (progress.setIdentity !== undefined) {
        continue;
      }
      candidates += 1;
      if (input.apply) {
        yield* Effect.promise(() =>
          ctx.db.patch("tryoutSetProgress", progress._id, {
            setIdentity: stable.identity,
          })
        );
        updated += 1;
      }
    }
    return identityReceipt(rows.length, page, candidates, updated);
  }
);
