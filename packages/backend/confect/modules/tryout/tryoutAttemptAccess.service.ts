import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import { syncTryoutAttemptExpiry } from "@repo/backend/confect/modules/tryout/tryoutExpiry.service";
import { Effect } from "effect";

/** Loads a tryout attempt and verifies the current user owns it. */
export const requireOwnedTryoutAttempt = Effect.fn(
  "tryouts.access.requireOwnedTryoutAttempt"
)(function* (
  ctx: ConvexMutationCtx,
  args: {
    readonly tryoutAttemptId: Id<"tryoutAttempts">;
    readonly userId: Id<"users">;
  }
) {
  const tryoutAttempt = yield* Effect.promise(() =>
    ctx.db.get(args.tryoutAttemptId)
  );

  if (!tryoutAttempt) {
    return yield* Effect.fail(
      new TryoutError({
        code: "ATTEMPT_NOT_FOUND",
        message: "Tryout attempt not found.",
      })
    );
  }

  if (tryoutAttempt.userId === args.userId) {
    return tryoutAttempt;
  }

  return yield* Effect.fail(
    new TryoutError({
      code: "FORBIDDEN",
      message: "You do not have access to this tryout attempt.",
    })
  );
});

/** Re-checks expiry and requires an in-progress tryout attempt. */
export const requireActiveTryoutAttemptAfterExpirySync = Effect.fn(
  "tryouts.access.requireActiveAfterExpirySync"
)(function* (
  ctx: ConvexMutationCtx,
  args: {
    readonly now: number;
    readonly tryoutAttempt: Doc<"tryoutAttempts">;
  }
) {
  const tryoutExpiry = yield* syncTryoutAttemptExpiry(
    ctx,
    args.tryoutAttempt,
    args.now
  );

  if (tryoutExpiry.expired) {
    return yield* Effect.fail(
      new TryoutError({
        code: "TRYOUT_EXPIRED",
        message: "This tryout has expired.",
      })
    );
  }

  const currentTryoutAttempt = yield* Effect.promise(() =>
    ctx.db.get(args.tryoutAttempt._id)
  );

  if (!currentTryoutAttempt) {
    return yield* Effect.fail(
      new TryoutError({
        code: "ATTEMPT_NOT_FOUND",
        message: "Tryout attempt not found.",
      })
    );
  }

  if (currentTryoutAttempt.status === "in-progress") {
    return currentTryoutAttempt;
  }

  return yield* Effect.fail(
    new TryoutError({
      code: "INVALID_ATTEMPT_STATUS",
      message: "Tryout attempt is not in progress.",
    })
  );
});
