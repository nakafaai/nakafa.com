import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { requireTryoutResponseSectionSnapshot } from "@repo/backend/convex/tryouts/response/integrity";
import {
  getTryoutSectionContentAccess,
  noTryoutSectionContentAccess,
} from "@repo/backend/convex/tryouts/runtime/content";
import { loadSectionPlacements } from "@repo/backend/convex/tryouts/runtime/placement";
import { loadSectionResponseIndex } from "@repo/backend/convex/tryouts/runtime/response";
import { projectTryoutSignedContent } from "@repo/backend/convex/tryouts/runtime/selectors";
import { getSectionScoreResult } from "@repo/backend/convex/tryouts/score/result";
import { Effect } from "effect";

type TryoutPlacement = Doc<"tryoutAttemptPlacements">;
type TryoutResponse = Doc<"tryoutResponses">;

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

/** Loads one bounded section graph shared by old and new runtime contracts. */
const loadSectionRows = Effect.fn("tryouts.runtime.loadSectionRows")(function* (
  ctx: QueryCtx,
  attempt: Doc<"tryoutAttempts">,
  section: Doc<"tryoutSectionAttempts">
) {
  const access = getTryoutSectionContentAccess(attempt.status, section.status);
  if (!access.questions) {
    return null;
  }

  const snapshot = yield* requireTryoutResponseSectionSnapshot(
    attempt,
    section
  );
  const placements = yield* loadSectionPlacements(ctx, attempt, snapshot);
  const loaded = yield* loadSectionResponseIndex(
    ctx,
    attempt,
    section,
    placements
  );
  const currentSection = yield* readCurrentSection(section);
  return { access, currentSection, ...loaded };
});

/** Loads the deployed runtime shape until the current web switches contracts. */
export const loadSectionRuntime = Effect.fn("tryouts.runtime.loadSection")(
  function* (
    ctx: QueryCtx,
    attempt: Doc<"tryoutAttempts">,
    section: Doc<"tryoutSectionAttempts">
  ) {
    const loaded = yield* loadSectionRows(ctx, attempt, section);
    if (!loaded) {
      return null;
    }
    const questions = projectRuntimeQuestions(
      loaded.placements,
      loaded.responses,
      loaded.access
    );

    return {
      attemptId: attempt._id,
      expiresAt: section.expiresAt,
      questions,
      section: loaded.currentSection,
    };
  }
);

/** Loads the compact runtime plus immutable content selectors once. */
export const loadSectionState = Effect.fn("tryouts.runtime.loadSectionState")(
  function* (
    ctx: QueryCtx,
    attempt: Doc<"tryoutAttempts">,
    section: Doc<"tryoutSectionAttempts">
  ) {
    const loaded = yield* loadSectionRows(ctx, attempt, section);
    if (!loaded) {
      return { content: noTryoutSectionContentAccess, runtime: null };
    }

    const content = yield* projectTryoutSignedContent({
      access: loaded.access,
      attempt,
      ctx,
      locale: attempt.locale,
      placements: loaded.placements,
      totalQuestions: section.totalQuestions,
    });
    return {
      content,
      runtime: {
        attemptId: attempt._id,
        expiresAt: section.expiresAt,
        questions: projectRuntimeQuestions(
          loaded.placements,
          loaded.responses,
          loaded.access
        ).map(({ title: _title, ...question }) => question),
        section: loaded.currentSection,
      },
    };
  }
);

/** Projects mutable response state without repeating immutable page fields. */
function projectRuntimeQuestions(
  placements: readonly TryoutPlacement[],
  responses: ReadonlyMap<TryoutPlacement["_id"], TryoutResponse>,
  access: { readonly answers: boolean; readonly questions: boolean }
) {
  return placements.map((placement) => {
    const response = responses.get(placement._id) ?? null;
    const choices = [...placement.choiceSnapshots].sort(
      (left, right) => left.order - right.order
    );

    return {
      choices: choices.map((choice) => ({
        ...(access.answers ? { isCorrect: choice.isCorrect } : {}),
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
            ...(response.selectedOptionId === undefined
              ? {}
              : { selectedOptionId: response.selectedOptionId }),
            updatedAt: response.updatedAt,
          }
        : null,
      sourcePath: placement.sourcePath,
      sourceRevision: placement.sourceRevision,
      title: placement.title,
    };
  });
}
