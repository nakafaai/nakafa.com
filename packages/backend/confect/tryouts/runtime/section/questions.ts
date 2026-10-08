import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  project,
  projectSelection,
} from "@repo/backend/confect/response/projection";
import { requireTryoutResponseSectionSnapshot } from "@repo/backend/confect/tryouts/response/integrity";
import { readOutcome } from "@repo/backend/confect/tryouts/response/outcome";
import { readTryoutSectionContentAccess } from "@repo/backend/confect/tryouts/runtime/content";
import { loadSectionPlacements } from "@repo/backend/confect/tryouts/runtime/placement";
import { loadSectionResponseIndex } from "@repo/backend/confect/tryouts/runtime/response";
import { projectTryoutSignedContent } from "@repo/backend/confect/tryouts/runtime/selectors";
import { noTryoutSectionContentAccess } from "@repo/backend/confect/tryouts/runtime/spec";
import { getSectionScoreResult } from "@repo/backend/confect/tryouts/score/result";
import { Array as Arr, Effect } from "effect";

type TryoutPlacement = Docs["tryoutAttemptPlacements"];
type TryoutResponse = Docs["tryoutResponses"];

/** Projects the public state shared by attempt and runtime responses. */
export const readCurrentSection = Effect.fn(
  "tryouts.runtime.readCurrentSection"
)(function* (section: Docs["tryoutSectionAttempts"]) {
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
  attempt: Docs["tryoutAttempts"],
  section: Docs["tryoutSectionAttempts"]
) {
  const access = yield* readTryoutSectionContentAccess(attempt, section.status);
  if (!access.questions) {
    return null;
  }
  const snapshot = yield* requireTryoutResponseSectionSnapshot(
    attempt,
    section
  );
  const placements = yield* loadSectionPlacements(attempt, snapshot);
  const loaded = yield* loadSectionResponseIndex(attempt, section, placements);
  const currentSection = yield* readCurrentSection(section);
  return {
    access,
    currentSection,
    ...loaded,
  };
});

/** Loads the compact runtime plus immutable content selectors once. */
export const loadSectionState = Effect.fn("tryouts.runtime.loadSectionState")(
  function* (
    attempt: Docs["tryoutAttempts"],
    section: Docs["tryoutSectionAttempts"],
    appLocale: AppLocaleCode = attempt.appLocale
  ) {
    const loaded = yield* loadSectionRows(attempt, section);
    if (!loaded) {
      return {
        content: noTryoutSectionContentAccess,
        runtime: null,
      };
    }
    const content = yield* projectTryoutSignedContent({
      answers: loaded.access.answers,
      attempt,
      appLocale,
      placements: loaded.placements,
      preview: loaded.access.preview,
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
        ),
        section: loaded.currentSection,
      },
    };
  }
);

/** Projects mutable response state without repeating immutable page fields. */
function projectRuntimeQuestions(
  placements: readonly TryoutPlacement[],
  responses: ReadonlyMap<TryoutPlacement["_id"], TryoutResponse>,
  access: {
    readonly answers: boolean;
    readonly questions: boolean;
  }
) {
  return Arr.map(placements, (placement) =>
    projectRuntimeQuestion(placement, responses, access)
  );
}

/** Projects one validated frozen placement and optional learner response. */
function projectRuntimeQuestion(
  placement: TryoutPlacement,
  responses: ReadonlyMap<TryoutPlacement["_id"], TryoutResponse>,
  access: {
    readonly answers: boolean;
    readonly questions: boolean;
  }
) {
  const response = responses.get(placement._id) ?? null;
  const runtimeResponse = response
    ? {
        answeredAt: response.answeredAt,
        isComplete: response.isComplete,
        ...(access.answers ? { outcome: readOutcome(response) } : {}),
        selection: projectSelection(response.selection, access.answers),
        updatedAt: response.updatedAt,
      }
    : null;
  return {
    contentHash: placement.contentHash,
    placementId: placement._id,
    questionOrder: placement.questionOrder,
    response: runtimeResponse,
    responseSpec: project(placement.responseSpec, access.answers),
    sourcePath: placement.sourcePath,
    sourceRevision: placement.sourceRevision,
  };
}
