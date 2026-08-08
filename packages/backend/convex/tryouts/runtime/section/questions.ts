import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { getTryoutSectionContentAccess } from "@repo/backend/convex/tryouts/runtime/content";
import { getSectionScoreResult } from "@repo/backend/convex/tryouts/score/result";
import { Effect, Schema } from "effect";

/** Stable integrity failure while reading one bounded section runtime. */
class TryoutRuntimeReadError extends Schema.TaggedError<TryoutRuntimeReadError>()(
  "TryoutRuntimeReadError",
  {
    code: Schema.Literal(
      "TRYOUT_PLACEMENT_COUNT_EXCEEDED",
      "TRYOUT_RESPONSE_COUNT_EXCEEDED"
    ),
    message: Schema.String,
  }
) {}

/** Loads bounded runtime responses for one section attempt. */
const loadRuntimeResponses = Effect.fn("tryouts.runtime.loadResponses")(
  function* (ctx: QueryCtx, section: Doc<"tryoutSectionAttempts">) {
    const responses = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutResponses")
        .withIndex("by_tryoutSectionAttemptId_and_answeredAt", (query) =>
          query.eq("tryoutSectionAttemptId", section._id)
        )
        .take(section.totalQuestions + 1)
    );

    if (responses.length > section.totalQuestions) {
      return yield* new TryoutRuntimeReadError({
        code: "TRYOUT_RESPONSE_COUNT_EXCEEDED",
        message: "Try-out response count exceeds the section question count.",
      });
    }

    return new Map(
      responses.map((response) => [response.placementId, response])
    );
  }
);

/** Loads placements through the immutable signed section key. */
const loadRuntimePlacements = Effect.fn("tryouts.runtime.loadPlacements")(
  function* (
    ctx: QueryCtx,
    attempt: Doc<"tryoutAttempts">,
    section: Doc<"tryoutSectionAttempts">
  ) {
    return yield* Effect.promise(() =>
      ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex(
          "by_tryoutAttemptId_and_sectionKey_and_questionOrder",
          (index) =>
            index
              .eq("tryoutAttemptId", attempt._id)
              .eq("sectionKey", section.sectionKey)
        )
        .take(section.totalQuestions + 1)
    );
  }
);

/** Projects the public state shared by attempt and runtime responses. */
export const readCurrentSection = Effect.fn(
  "tryouts.runtime.readCurrentSection"
)(function* (section: Doc<"tryoutSectionAttempts">) {
  return {
    answeredCount: section.answeredCount,
    completedAt: section.completedAt,
    endReason: section.endReason,
    expiresAt: section.expiresAt,
    score: yield* getSectionScoreResult(section),
    sectionKey: section.sectionKey,
    startedAt: section.startedAt,
    status: section.status,
    totalQuestions: section.totalQuestions,
  };
});

/** Loads placements and responses for one already-owned section attempt. */
export const loadSectionRuntime = Effect.fn("tryouts.runtime.loadSection")(
  function* (
    ctx: QueryCtx,
    attempt: Doc<"tryoutAttempts">,
    section: Doc<"tryoutSectionAttempts">
  ) {
    const contentAccess = getTryoutSectionContentAccess(
      attempt.status,
      section.status
    );
    if (!contentAccess.questions) {
      return null;
    }

    const placements = yield* loadRuntimePlacements(ctx, attempt, section);
    if (placements.length !== section.totalQuestions) {
      return yield* new TryoutRuntimeReadError({
        code: "TRYOUT_PLACEMENT_COUNT_EXCEEDED",
        message: "Try-out section has more placements than its snapshot count.",
      });
    }

    const responses = yield* loadRuntimeResponses(ctx, section);
    const currentSection = yield* readCurrentSection(section);
    const questions = placements.map((placement) => {
      const response = responses.get(placement._id) ?? null;
      const choices = [...placement.choiceSnapshots].sort(
        (left, right) => left.order - right.order
      );

      return {
        choices: choices.map((choice) => ({
          ...(contentAccess.answers ? { isCorrect: choice.isCorrect } : {}),
          label: choice.label,
          optionKey: choice.optionKey,
          order: choice.order,
        })),
        contentHash: placement.contentHash,
        placementId: placement._id,
        questionOrder: placement.questionOrder,
        response: response
          ? {
              answeredAt: response.answeredAt,
              selectedOptionId: response.selectedOptionId,
              updatedAt: response.updatedAt,
            }
          : null,
        sourcePath: placement.sourcePath,
        sourceRevision: placement.sourceRevision,
        title: placement.title,
      };
    });

    return {
      attemptId: attempt._id,
      expiresAt: section.expiresAt,
      questions,
      section: currentSection,
    };
  }
);
