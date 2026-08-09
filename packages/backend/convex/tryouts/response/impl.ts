import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  indexTryoutResponses,
  requireTryoutResponseSectionSnapshot,
  TryoutResponseIntegrityError,
  validateTryoutResponsePlacements,
} from "@repo/backend/convex/tryouts/response/integrity";
import {
  type SaveTryoutResponseArgs,
  TryoutResponseError,
  toTryoutResponseError,
} from "@repo/backend/convex/tryouts/response/spec";
import { getAttemptExpiresAt } from "@repo/backend/convex/tryouts/runtime/finish";
import { requireOwnedAttempt } from "@repo/backend/convex/tryouts/runtime/score";
import { loadPlacementSectionAttempt } from "@repo/backend/convex/tryouts/runtime/sectionAttempt";
import { Effect } from "effect";

type TryoutPlacement = Doc<"tryoutAttemptPlacements">;
type TryoutSectionAttempt = Doc<"tryoutSectionAttempts">;

/** Lifts one Convex write into the typed response error channel. */
function tryResponsePromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ catch: toTryoutResponseError, try: operation });
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
    const section = yield* tryResponsePromise(() =>
      loadPlacementSectionAttempt(ctx, placement)
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

/** Saves one selected choice against immutable placement snapshots. */
export const saveTryoutResponse = Effect.fn("tryouts.response.save")(function* (
  ctx: MutationCtx,
  input: {
    readonly args: SaveTryoutResponseArgs;
    readonly now: number;
    readonly userId: Id<"users">;
  }
) {
  const placement = yield* requirePlacement(ctx, input.args.placementId);
  const attempt = yield* tryResponsePromise(() =>
    requireOwnedAttempt(ctx, {
      attemptId: placement.tryoutAttemptId,
      userId: input.userId,
    })
  );
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
  const selectedChoice = placement.choiceSnapshots.find(
    (choice) => choice.optionKey === input.args.selectedOptionId
  );
  if (!selectedChoice) {
    return yield* new TryoutResponseError({
      code: "TRYOUT_CHOICE_NOT_FOUND",
      message:
        "Try-out selected choice does not belong to this frozen question.",
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
  if (existing) {
    const answeredDelta =
      existing.selectedOptionId === undefined &&
      existing.textAnswer === undefined
        ? 1
        : 0;
    const correctDelta =
      (selectedChoice.isCorrect ? 1 : 0) - (existing.isCorrect ? 1 : 0);

    yield* tryResponsePromise(() =>
      ctx.db.patch(existing._id, {
        isCorrect: selectedChoice.isCorrect,
        selectedOptionId: selectedChoice.optionKey,
        textAnswer: undefined,
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
      isCorrect: selectedChoice.isCorrect,
      placementId: placement._id,
      selectedOptionId: selectedChoice.optionKey,
      timeSpent,
      tryoutAttemptId: placement.tryoutAttemptId,
      tryoutSectionAttemptId: section._id,
      updatedAt: input.now,
    })
  );
  yield* updateResponseActivity(ctx, {
    answeredDelta: 1,
    attemptId: attempt._id,
    correctDelta: selectedChoice.isCorrect ? 1 : 0,
    now: input.now,
    section,
  });
  return null;
});

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
