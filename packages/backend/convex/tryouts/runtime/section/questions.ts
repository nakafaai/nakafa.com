import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { requireTryoutResponseSectionSnapshot } from "@repo/backend/convex/tryouts/response/integrity";
import {
  resolvePlacementResponseSpec,
  resolveStoredResponseSelection,
} from "@repo/backend/convex/tryouts/response/legacy";
import { projectTryoutResponseSpec } from "@repo/backend/convex/tryouts/response/model";
import {
  getTryoutSectionContentAccess,
  noTryoutSectionContentAccess,
} from "@repo/backend/convex/tryouts/runtime/content";
import { TryoutRuntimeError } from "@repo/backend/convex/tryouts/runtime/error";
import { readAttemptSetIdentity } from "@repo/backend/convex/tryouts/runtime/lookup";
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

/** Loads one bounded section graph for the exact-attempt runtime contract. */
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

    const identity = readAttemptSetIdentity(attempt);
    const content = yield* projectTryoutSignedContent({
      answers: loaded.access.answers,
      attempt,
      ctx,
      appLocale: identity.locale,
      placements: loaded.placements,
      totalQuestions: section.totalQuestions,
    });
    return {
      content,
      runtime: {
        attemptId: attempt._id,
        expiresAt: section.expiresAt,
        questions: yield* projectRuntimeQuestions(
          loaded.placements,
          loaded.responses,
          loaded.access
        ),
        section: loaded.currentSection,
      },
    };
  }
);

/** Projects mutable response state without repeating immutable page fields. */
const projectRuntimeQuestions = Effect.fn("tryouts.runtime.projectQuestions")(
  (
    placements: readonly TryoutPlacement[],
    responses: ReadonlyMap<TryoutPlacement["_id"], TryoutResponse>,
    access: { readonly answers: boolean; readonly questions: boolean }
  ) =>
    Effect.forEach(placements, (placement) =>
      projectRuntimeQuestion(placement, responses, access)
    )
);

/** Projects one validated frozen placement and optional learner response. */
const projectRuntimeQuestion = Effect.fn("tryouts.runtime.projectQuestion")(
  function* (
    placement: TryoutPlacement,
    responses: ReadonlyMap<TryoutPlacement["_id"], TryoutResponse>,
    access: { readonly answers: boolean; readonly questions: boolean }
  ) {
    const response = responses.get(placement._id) ?? null;
    const responseSpec = yield* resolvePlacementResponseSpec(placement).pipe(
      Effect.mapError(
        (cause) =>
          new TryoutRuntimeError({
            cause,
            code: "TRYOUT_RESPONSE_DEFINITION_INVALID",
            message: cause.message,
          })
      )
    );
    const runtimeResponse = response
      ? {
          answeredAt: response.answeredAt,
          isComplete: response.isComplete ?? true,
          selection: yield* resolveStoredResponseSelection(response).pipe(
            Effect.mapError(
              (cause) =>
                new TryoutRuntimeError({
                  cause,
                  code: "TRYOUT_RESPONSE_SELECTION_INVALID",
                  message: cause.message,
                })
            )
          ),
          updatedAt: response.updatedAt,
        }
      : null;
    const predecessorSelectedOptionId =
      runtimeResponse?.selection.kind === "single-choice"
        ? runtimeResponse.selection.optionKey
        : undefined;
    const choices =
      responseSpec.kind === "category"
        ? []
        : responseSpec.options.map((option) => ({
            ...(access.answers ? { isCorrect: option.isCorrect } : {}),
            label: option.label,
            optionKey: option.optionKey,
            order: option.order,
          }));

    return {
      choices,
      contentHash: placement.contentHash,
      placementId: placement._id,
      questionOrder: placement.questionOrder,
      response: runtimeResponse
        ? {
            ...runtimeResponse,
            ...(predecessorSelectedOptionId
              ? { selectedOptionId: predecessorSelectedOptionId }
              : {}),
          }
        : null,
      responseSpec: projectTryoutResponseSpec(responseSpec, access.answers),
      sourcePath: placement.sourcePath,
      sourceRevision: placement.sourceRevision,
    };
  }
);
