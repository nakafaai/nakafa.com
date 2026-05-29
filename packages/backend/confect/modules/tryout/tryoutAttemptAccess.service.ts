import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import { syncTryoutAttemptExpiry } from "@repo/backend/confect/modules/tryout/tryoutExpiry.service";
import type { TryoutAttempts } from "@repo/backend/confect/modules/tryout/tryouts.tables";
import { Effect } from "effect";

type TryoutAttemptDoc = typeof TryoutAttempts.Doc.Type;

/** Loads a tryout attempt and verifies the current user owns it. */
export const requireOwnedTryoutAttempt = Effect.fnUntraced(function* (args: {
  readonly tryoutAttemptId: Id<"tryoutAttempts">;
  readonly userId: Id<"users">;
}) {
  const reader = yield* DatabaseReader;
  const tryoutAttempt = yield* reader
    .table("tryoutAttempts")
    .get(args.tryoutAttemptId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

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
export const requireActiveTryoutAttemptAfterExpirySync = Effect.fnUntraced(
  function* (args: {
    readonly now: number;
    readonly tryoutAttempt: TryoutAttemptDoc;
  }) {
    const tryoutExpiry = yield* syncTryoutAttemptExpiry(
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

    const reader = yield* DatabaseReader;
    const currentTryoutAttempt = yield* reader
      .table("tryoutAttempts")
      .get(args.tryoutAttempt._id)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

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
  }
);
