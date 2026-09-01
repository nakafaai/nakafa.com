import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { evaluateTryoutResponse } from "@repo/backend/convex/tryouts/response/evaluation";
import {
  indexTryoutResponses,
  requireTryoutResponseSectionSnapshot,
  TryoutResponseIntegrityError,
  validateTryoutResponsePlacements,
} from "@repo/backend/convex/tryouts/response/integrity";
import { resolvePlacementResponseSpec } from "@repo/backend/convex/tryouts/response/legacy";
import type { TryoutResponseSelection } from "@repo/backend/convex/tryouts/response/model";
import {
  type SaveTryoutResponseArgs,
  TryoutResponseError,
  toTryoutResponseError,
} from "@repo/backend/convex/tryouts/response/spec";
import type { TryoutRuntimeError } from "@repo/backend/convex/tryouts/runtime/error";
import { getAttemptExpiresAt } from "@repo/backend/convex/tryouts/runtime/finish";
import { requireOwnedAttempt } from "@repo/backend/convex/tryouts/runtime/score";
import { loadPlacementSectionAttempt } from "@repo/backend/convex/tryouts/runtime/sectionAttempt";
import { Effect } from "effect";

type TryoutPlacement = Doc<"tryoutAttemptPlacements">;
type TryoutSectionAttempt = Doc<"tryoutSectionAttempts">;

/** Lifts one Convex database operation into the typed response error channel. */
function tryResponsePromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ catch: toTryoutResponseError, try: operation });
}

/** Preserves an expected ownership denial while masking lookup failures. */
function toOwnedAttemptResponseError(error: TryoutRuntimeError) {
  if (error.code !== "TRYOUT_ATTEMPT_NOT_FOUND") {
    return toTryoutResponseError(error);
  }

  return new TryoutResponseError({
    cause: error,
    code: error.code,
    message: error.message,
  });
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
  function* (
    ctx: MutationCtx,
    placementId: SaveTryoutResponseArgs["placementId"]
  ) {
    const placement = yield* tryResponsePromise(() => ctx.db.get(placementId));
    if (!placement) {
      return yield* new TryoutResponseError({
        code: "TRYOUT_PLACEMENT_NOT_FOUND",
        message: "Try-out question placement not found.",
      });
    }
    return placement;
  }
);

/** Loads the active timer that authorizes one placement response. */
const requireActiveSection = Effect.fn("tryouts.response.requireActiveSection")(
  function* (ctx: MutationCtx, placement: TryoutPlacement) {
    const section = yield* loadPlacementSectionAttempt(ctx, placement).pipe(
      Effect.mapError(toTryoutResponseError)
    );
    if (section?.status !== "in-progress") {
      return yield* new TryoutResponseError({
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
export const saveTryoutResponse = Effect.fn("tryouts.response.save")(function* (
  ctx: MutationCtx,
  input: {
    readonly args: SaveTryoutResponseArgs;
    readonly now: number;
    readonly userId: Id<"users">;
  }
) {
  const placement = yield* requirePlacement(ctx, input.args.placementId);
  const attempt = yield* requireOwnedAttempt(ctx, {
    attemptId: placement.tryoutAttemptId,
    userId: input.userId,
  }).pipe(Effect.mapError(toOwnedAttemptResponseError));
  if (attempt.status !== "in-progress") {
    return yield* new TryoutResponseError({
      code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      message: "Try-out attempt is not active.",
    });
  }

  const section = yield* requireActiveSection(ctx, placement);
  const sectionSnapshot = yield* requireTryoutResponseSectionSnapshot(
    attempt,
    section
  );
  yield* validateTryoutResponsePlacements(attempt._id, sectionSnapshot, [
    placement,
  ]);
  if (
    input.now >= getAttemptExpiresAt(attempt) ||
    input.now >= section.expiresAt
  ) {
    return yield* new TryoutResponseError({
      code: "TRYOUT_EXPIRED",
      message: "Try-out attempt time has expired.",
    });
  }

  const existingResponses = yield* tryResponsePromise(() =>
    ctx.db
      .query("tryoutResponses")
      .withIndex("by_placementId", (query) =>
        query.eq("placementId", placement._id)
      )
      .take(2)
  );
  if (existingResponses.length > 1) {
    return yield* new TryoutResponseIntegrityError({
      code: "TRYOUT_RESPONSE_PLACEMENT_DUPLICATE",
      message: "Try-out placement has more than one response.",
    });
  }
  yield* indexTryoutResponses({
    attemptId: attempt._id,
    links: [{ placement, sectionAttemptId: section._id }],
    responses: existingResponses,
  });
  const existing = existingResponses.at(0);
  const timeSpent = getResponseTimeSpent(section, input.now);
  const selection = yield* readSaveSelection(input.args);
  if (selection === null) {
    if (!existing) {
      return null;
    }
    yield* tryResponsePromise(() => ctx.db.delete(existing._id));
    yield* updateResponseActivity(ctx, {
      answeredDelta: existing.isComplete === false ? 0 : -1,
      attemptId: attempt._id,
      correctDelta: existing.isCorrect ? -1 : 0,
      now: input.now,
      section,
    });
    return null;
  }

  const responseSpec = yield* resolvePlacementResponseSpec(placement).pipe(
    Effect.mapError(
      (cause) =>
        new TryoutResponseError({
          cause,
          code: "TRYOUT_RESPONSE_DEFINITION_INVALID",
          message: cause.message,
        })
    )
  );
  const evaluated = yield* evaluateTryoutResponse(responseSpec, selection).pipe(
    Effect.mapError(
      (cause) =>
        new TryoutResponseError({
          cause,
          code: cause.code,
          message: cause.message,
        })
    )
  );
  if (existing) {
    const correctDelta =
      (evaluated.isCorrect ? 1 : 0) - (existing.isCorrect ? 1 : 0);
    const answeredDelta =
      (evaluated.isComplete ? 1 : 0) - (existing.isComplete === false ? 0 : 1);

    yield* tryResponsePromise(() =>
      ctx.db.patch(existing._id, {
        isComplete: evaluated.isComplete,
        isCorrect: evaluated.isCorrect,
        selectedOptionId: predecessorOptionId(evaluated.selection),
        selection: evaluated.selection,
        timeSpent,
        updatedAt: input.now,
      })
    );
    yield* updateResponseActivity(ctx, {
      answeredDelta,
      attemptId: attempt._id,
      correctDelta,
      now: input.now,
      section,
    });
    return null;
  }

  yield* tryResponsePromise(() =>
    ctx.db.insert("tryoutResponses", {
      answeredAt: input.now,
      isComplete: evaluated.isComplete,
      isCorrect: evaluated.isCorrect,
      placementId: placement._id,
      selectedOptionId: predecessorOptionId(evaluated.selection),
      selection: evaluated.selection,
      timeSpent,
      tryoutAttemptId: placement.tryoutAttemptId,
      tryoutSectionAttemptId: section._id,
      updatedAt: input.now,
    })
  );
  yield* updateResponseActivity(ctx, {
    answeredDelta: evaluated.isComplete ? 1 : 0,
    attemptId: attempt._id,
    correctDelta: evaluated.isCorrect ? 1 : 0,
    now: input.now,
    section,
  });
  return null;
});

/** Retains the old single-choice field until observed callers are contracted. */
function predecessorOptionId(selection: TryoutResponseSelection) {
  return selection.kind === "single-choice" ? selection.optionKey : undefined;
}

/** Normalizes the public expand contract before domain evaluation. */
const readSaveSelection = Effect.fn("tryouts.response.readSaveSelection")(
  function* (args: SaveTryoutResponseArgs) {
    if (args.selection !== undefined && args.selectedOptionId === undefined) {
      yield* Effect.logInfo("Used canonical try-out response argument", {
        contract: "selection",
      });
      return args.selection;
    }
    if (args.selection === undefined && args.selectedOptionId !== undefined) {
      yield* Effect.logInfo("Used predecessor try-out response argument", {
        contract: "selectedOptionId",
      });
      return {
        kind: "single-choice",
        optionKey: args.selectedOptionId,
      } satisfies TryoutResponseSelection;
    }
    return yield* new TryoutResponseError({
      code: "TRYOUT_RESPONSE_ARGUMENT_INVALID",
      message: "Try-out response requires exactly one learner selection.",
    });
  }
);

/** Applies one response delta to its section and parent activity clocks. */
const updateResponseActivity = Effect.fn("tryouts.response.updateActivity")(
  function* (
    ctx: MutationCtx,
    input: {
      readonly answeredDelta: number;
      readonly attemptId: Id<"tryoutAttempts">;
      readonly correctDelta: number;
      readonly now: number;
      readonly section: TryoutSectionAttempt;
    }
  ) {
    yield* tryResponsePromise(() =>
      ctx.db.patch(input.section._id, {
        answeredCount: input.section.answeredCount + input.answeredDelta,
        correctAnswers: input.section.correctAnswers + input.correctDelta,
        lastActivityAt: input.now,
      })
    );
    yield* tryResponsePromise(() =>
      ctx.db.patch(input.attemptId, { lastActivityAt: input.now })
    );
  }
);
