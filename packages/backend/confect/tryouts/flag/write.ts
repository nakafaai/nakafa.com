import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import { indexTryoutFlags } from "@repo/backend/confect/tryouts/flag/read";
import {
  type SetTryoutFlagArgs,
  TryoutFlagError,
  toTryoutFlagError,
} from "@repo/backend/confect/tryouts/flag/spec";
import {
  requireTryoutResponseSectionSnapshot,
  validateTryoutResponsePlacements,
} from "@repo/backend/confect/tryouts/response/integrity";
import type { TryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import { requireOwnedAttempt } from "@repo/backend/confect/tryouts/runtime/score";
import { requireActiveSectionAttempt } from "@repo/backend/confect/tryouts/runtime/sectionAttempt";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, flow } from "effect";

/** Preserves an expected ownership denial while masking lookup failures. */
function toOwnedAttemptFlagError(
  error: TryoutRuntimeError | TryoutAttemptStateError
) {
  if (error.code !== "TRYOUT_ATTEMPT_NOT_FOUND") {
    return toTryoutFlagError(error);
  }
  return error;
}

/** Loads the exact placement one authenticated flag targets. */
const requirePlacement = Effect.fn("tryouts.flag.requirePlacement")(function* (
  placementId: SetTryoutFlagArgs["placementId"]
) {
  const database = yield* DatabaseReader;
  const placement = yield* database
    .table("tryoutAttemptPlacements")
    .get(placementId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (!placement) {
    return yield* new TryoutFlagError({
      code: "TRYOUT_PLACEMENT_NOT_FOUND",
      message: "Try-out question placement not found.",
    });
  }
  return placement;
});

/**
 * Sets or clears one review flag with the same ownership, timer, and snapshot
 * guards as a response. Repeating a call is a no-op, so clients may retry.
 */
export const setTryoutFlag = Effect.fn("tryouts.flag.set")(
  function* (input: {
    readonly args: SetTryoutFlagArgs;
    readonly now: number;
    readonly userId: Id<"users">;
  }) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const placement = yield* requirePlacement(input.args.placementId);
    const attempt = yield* requireOwnedAttempt({
      attemptId: placement.tryoutAttemptId,
      userId: input.userId,
    }).pipe(Effect.mapError(toOwnedAttemptFlagError));
    if (attempt.status !== "in-progress") {
      return yield* new TryoutAttemptStateError({
        code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
        message: "Try-out attempt is not active.",
      });
    }
    const section = yield* requireActiveSectionAttempt({
      attempt,
      sectionKey: placement.sectionKey,
    });
    const snapshot = yield* requireTryoutResponseSectionSnapshot(
      attempt,
      section
    );
    yield* validateTryoutResponsePlacements(attempt._id, snapshot, [placement]);
    if (input.now >= attempt.expiresAt || input.now >= section.expiresAt) {
      return yield* new TryoutFlagError({
        code: "TRYOUT_EXPIRED",
        message: "Try-out attempt time has expired.",
      });
    }
    const flags = yield* database
      .table("tryoutFlags")
      .index("by_placementId", (index) =>
        index.eq("placementId", placement._id)
      )
      .take(2)
      .pipe(Effect.orDie);
    yield* indexTryoutFlags({
      flags,
      placementIds: new Set([placement._id]),
      section,
    });
    const existing = flags.at(0);
    if (input.args.flagged && !existing) {
      yield* writer
        .table("tryoutFlags")
        .insert({
          flaggedAt: input.now,
          placementId: placement._id,
          tryoutAttemptId: attempt._id,
          tryoutSectionAttemptId: section._id,
        })
        .pipe(Effect.orDie);
    }
    if (!input.args.flagged && existing) {
      yield* writer.table("tryoutFlags").delete(existing._id);
    }
    return null;
  },
  Effect.catchDefect(flow(toTryoutFlagError, Effect.fail))
);
