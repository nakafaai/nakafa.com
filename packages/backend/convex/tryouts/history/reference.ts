import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { TryoutRuntimeError } from "@repo/backend/convex/tryouts/runtime/error";
import { Effect } from "effect";

type ReadCtx = Pick<MutationCtx | QueryCtx, "db">;
type TryoutAttempt = Doc<"tryoutAttempts">;

/** Reads the sole discriminator allowed to select immutable history bytes. */
export const readTryoutAttemptHistory = Effect.fn(
  "tryouts.history.readAttemptReference"
)(function* (ctx: ReadCtx, attempt: TryoutAttempt) {
  const reference = yield* Effect.tryPromise({
    catch: (cause) =>
      new TryoutRuntimeError({
        cause,
        code: "TRYOUT_HISTORY_REFERENCE_READ_FAILED",
        message: "Unable to read the retained try-out history reference.",
      }),
    try: () =>
      ctx.db
        .query("tryoutAttemptHistory")
        .withIndex("by_tryoutAttemptId", (index) =>
          index.eq("tryoutAttemptId", attempt._id)
        )
        .unique(),
  });
  if (!reference) {
    return null;
  }
  if (
    reference.tryoutSnapshotId !== attempt.tryoutSnapshotId ||
    reference.snapshotReleaseId !== attempt.snapshotReleaseId
  ) {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_HISTORY_REFERENCE_MISMATCH",
      message:
        "Retained try-out history no longer matches its attempt snapshot.",
    });
  }
  return reference;
});

/** Removes one attempt-owned history discriminator before deleting its owner. */
export const deleteTryoutAttemptHistory = Effect.fn(
  "tryouts.history.deleteAttemptReference"
)(function* (ctx: MutationCtx, attempt: TryoutAttempt) {
  const reference = yield* readTryoutAttemptHistory(ctx, attempt);
  if (!reference) {
    return;
  }
  yield* Effect.tryPromise({
    catch: (cause) =>
      new TryoutRuntimeError({
        cause,
        code: "TRYOUT_HISTORY_REFERENCE_DELETE_FAILED",
        message: "Unable to delete the retained try-out history reference.",
      }),
    try: () => ctx.db.delete("tryoutAttemptHistory", reference._id),
  });
});
