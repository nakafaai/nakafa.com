import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { loadSectionFlags } from "@repo/backend/confect/tryouts/flag/read";
import { requireTryoutResponseSectionSnapshot } from "@repo/backend/confect/tryouts/response/integrity";
import { projectTryoutResponseSpec } from "@repo/backend/confect/tryouts/response/model";
import { readTryoutSectionContentAccess } from "@repo/backend/confect/tryouts/runtime/content";
import { loadSectionPlacements } from "@repo/backend/confect/tryouts/runtime/placement";
import { loadSectionResponseIndex } from "@repo/backend/confect/tryouts/runtime/response";
import { projectTryoutSignedContent } from "@repo/backend/confect/tryouts/runtime/selectors";
import { noTryoutSectionContentAccess } from "@repo/backend/confect/tryouts/runtime/spec";
import { getSectionScoreResult } from "@repo/backend/confect/tryouts/score/result";
import { Effect } from "effect";

type TryoutPlacement = Docs["tryoutAttemptPlacements"];
type TryoutResponse = Docs["tryoutResponses"];
/** Verified mutable learner rows of one section, keyed by frozen placement. */
interface SectionRows {
  readonly access: {
    readonly answers: boolean;
    readonly questions: boolean;
  };
  readonly flags: ReadonlySet<TryoutPlacement["_id"]>;
  readonly placements: readonly TryoutPlacement[];
  readonly responses: ReadonlyMap<TryoutPlacement["_id"], TryoutResponse>;
}

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
  const flags = yield* loadSectionFlags(section, loaded.placements);
  const currentSection = yield* readCurrentSection(section);
  return {
    access,
    currentSection,
    flags,
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
        questions: projectRuntimeQuestions(loaded),
        section: loaded.currentSection,
      },
    };
  }
);

/** Projects mutable response state without repeating immutable page fields. */
function projectRuntimeQuestions(section: SectionRows) {
  return section.placements.map((placement) =>
    projectRuntimeQuestion(placement, section)
  );
}

/** Projects one validated frozen placement and its learner response and flag. */
function projectRuntimeQuestion(
  placement: TryoutPlacement,
  section: SectionRows
) {
  const response = section.responses.get(placement._id) ?? null;
  const runtimeResponse = response
    ? {
        answeredAt: response.answeredAt,
        isComplete: response.isComplete,
        selection: response.selection,
        updatedAt: response.updatedAt,
      }
    : null;
  return {
    contentHash: placement.contentHash,
    flagged: section.flags.has(placement._id),
    placementId: placement._id,
    questionOrder: placement.questionOrder,
    response: runtimeResponse,
    responseSpec: projectTryoutResponseSpec(
      placement.responseSpec,
      section.access.answers
    ),
    sourcePath: placement.sourcePath,
    sourceRevision: placement.sourceRevision,
  };
}
