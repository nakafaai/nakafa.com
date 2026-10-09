import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { evaluate } from "@repo/backend/confect/response/evaluation";
import type { Outcome } from "@repo/backend/confect/response/model";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import {
  indexTryoutResponses,
  requireTryoutResponseSectionSnapshot,
  validateTryoutResponsePlacements,
} from "@repo/backend/confect/tryouts/response/integrity";
import { readOutcome } from "@repo/backend/confect/tryouts/response/outcome";
import {
  type SaveTryoutResponseArgs,
  TryoutResponseError,
  TryoutResponseIntegrityError,
  toTryoutResponseError,
  toTryoutSelectionError,
} from "@repo/backend/confect/tryouts/response/spec";
import type { TryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import { requireOwnedAttempt } from "@repo/backend/confect/tryouts/runtime/score";
import { loadPlacementSectionAttempt } from "@repo/backend/confect/tryouts/runtime/sectionAttempt";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, flow } from "effect";

type TryoutPlacement = Docs["tryoutAttemptPlacements"];
type TryoutSectionAttempt = Docs["tryoutSectionAttempts"];

/** Preserves an expected ownership denial while masking lookup failures. */
function toOwnedAttemptResponseError(
  error: TryoutRuntimeError | TryoutAttemptStateError
) {
  if (error.code !== "TRYOUT_ATTEMPT_NOT_FOUND") {
    return TryoutResponseError.make({
      cause: error,
      code: "TRYOUT_RESPONSE_FAILED",
      message: "Unable to save try-out response.",
    });
  }
  return error;
}

/** Counts one outcome toward the correct-answer counters. */
function correctCount(outcome: Outcome) {
  return outcome.status === "correct" ? 1 : 0;
}

/** Returns elapsed section seconds from authoritative server timestamps. */
function getResponseTimeSpent(section: TryoutSectionAttempt, now: number) {
  const elapsedSeconds = Math.floor((now - section.startedAt) / 1000);
  const sectionSeconds = Math.floor(
    (section.expiresAt - section.startedAt) / 1000
  );
  return Math.min(Math.max(0, sectionSeconds), Math.max(0, elapsedSeconds));
}

/** Loads the exact placement selected by one authenticated response. */
const requirePlacement = Effect.fn("tryouts.response.requirePlacement")(
  function* (placementId: SaveTryoutResponseArgs["placementId"]) {
    const database = yield* DatabaseReader;
    const placement = yield* database
      .table("tryoutAttemptPlacements")
      .get(placementId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!placement) {
      return yield* TryoutResponseError.make({
        code: "TRYOUT_PLACEMENT_NOT_FOUND",
        message: "Try-out question placement not found.",
      });
    }
    return placement;
  }
);

/** Loads the active timer that authorizes one placement response. */
const requireActiveSection = Effect.fn("tryouts.response.requireActiveSection")(
  function* (placement: TryoutPlacement) {
    const section = yield* loadPlacementSectionAttempt(placement);
    if (section?.status !== "in-progress") {
      return yield* TryoutAttemptStateError.make({
        code: "TRYOUT_SECTION_NOT_ACTIVE",
        message: "Try-out section is not active.",
      });
    }
    return section;
  }
);

/**
 * Saves one selected choice and its parent counters in one atomic mutation.
 * @see https://docs.convex.dev/functions/mutation-functions#transactions
 */
export const saveTryoutResponse = Effect.fn("tryouts.response.save")(
  function* (input: {
    readonly args: SaveTryoutResponseArgs;
    readonly now: number;
    readonly userId: Id<"users">;
  }) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const placement = yield* requirePlacement(input.args.placementId);
    const attempt = yield* requireOwnedAttempt({
      attemptId: placement.tryoutAttemptId,
      userId: input.userId,
    }).pipe(Effect.mapError(toOwnedAttemptResponseError));
    if (attempt.status !== "in-progress") {
      return yield* TryoutAttemptStateError.make({
        code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
        message: "Try-out attempt is not active.",
      });
    }
    const section = yield* requireActiveSection(placement);
    const sectionSnapshot = yield* requireTryoutResponseSectionSnapshot(
      attempt,
      section
    );
    yield* validateTryoutResponsePlacements(attempt._id, sectionSnapshot, [
      placement,
    ]);
    if (input.now >= attempt.expiresAt || input.now >= section.expiresAt) {
      return yield* TryoutResponseError.make({
        code: "TRYOUT_EXPIRED",
        message: "Try-out attempt time has expired.",
      });
    }
    const existingResponses = yield* database
      .table("tryoutResponses")
      .index("by_placementId", (query) =>
        query.eq("placementId", placement._id)
      )
      .take(2)
      .pipe(Effect.orDie);
    if (existingResponses.length > 1) {
      return yield* TryoutResponseIntegrityError.make({
        code: "TRYOUT_RESPONSE_PLACEMENT_DUPLICATE",
        message: "Try-out placement has more than one response.",
      });
    }
    yield* indexTryoutResponses({
      attemptId: attempt._id,
      links: [
        {
          placement,
          sectionAttemptId: section._id,
        },
      ],
      responses: existingResponses,
    });
    const existing = existingResponses.at(0);
    const timeSpent = getResponseTimeSpent(section, input.now);
    const selection = input.args.selection;
    if (selection === null) {
      if (!existing) {
        return null;
      }
      yield* writer.table("tryoutResponses").delete(existing._id);
      yield* updateResponseActivity({
        answeredDelta: -Number(existing.isComplete),
        attemptId: attempt._id,
        correctDelta: -correctCount(readOutcome(existing)),
        now: input.now,
        section,
      });
      return null;
    }
    const evaluated = yield* Effect.fromResult(
      evaluate(placement.responseSpec, selection)
    ).pipe(Effect.mapError(toTryoutSelectionError));
    const isCorrect = evaluated.outcome.status === "correct";
    if (existing) {
      const correctDelta =
        correctCount(evaluated.outcome) - correctCount(readOutcome(existing));
      const answeredDelta =
        Number(evaluated.isComplete) - Number(existing.isComplete);
      yield* writer
        .table("tryoutResponses")
        .patch(existing._id, {
          isComplete: evaluated.isComplete,
          isCorrect,
          outcome: evaluated.outcome,
          selection: evaluated.selection,
          timeSpent,
          updatedAt: input.now,
        })
        .pipe(Effect.orDie);
      yield* updateResponseActivity({
        answeredDelta,
        attemptId: attempt._id,
        correctDelta,
        now: input.now,
        section,
      });
      return null;
    }
    yield* writer
      .table("tryoutResponses")
      .insert({
        answeredAt: input.now,
        isComplete: evaluated.isComplete,
        isCorrect,
        outcome: evaluated.outcome,
        placementId: placement._id,
        selection: evaluated.selection,
        timeSpent,
        tryoutAttemptId: placement.tryoutAttemptId,
        tryoutSectionAttemptId: section._id,
        updatedAt: input.now,
      })
      .pipe(Effect.orDie);
    yield* updateResponseActivity({
      answeredDelta: Number(evaluated.isComplete),
      attemptId: attempt._id,
      correctDelta: correctCount(evaluated.outcome),
      now: input.now,
      section,
    });
    return null;
  },
  Effect.catchDefect(flow(toTryoutResponseError, Effect.fail))
);

/** Applies one response delta to its section and parent activity clocks. */
const updateResponseActivity = Effect.fn("tryouts.response.updateActivity")(
  function* (input: {
    readonly answeredDelta: number;
    readonly attemptId: Id<"tryoutAttempts">;
    readonly correctDelta: number;
    readonly now: number;
    readonly section: TryoutSectionAttempt;
  }) {
    const writer = yield* DatabaseWriter;
    yield* writer.table("tryoutSectionAttempts").patch(input.section._id, {
      answeredCount: input.section.answeredCount + input.answeredDelta,
      correctAnswers: input.section.correctAnswers + input.correctDelta,
      lastActivityAt: input.now,
    });
    yield* writer.table("tryoutAttempts").patch(input.attemptId, {
      lastActivityAt: input.now,
    });
  },
  Effect.orDie
);
