import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  project,
  projectSelection,
} from "@repo/backend/confect/response/projection";
import { requireTryoutResponseSectionSnapshot } from "@repo/backend/confect/tryouts/response/integrity";
import { readOutcome } from "@repo/backend/confect/tryouts/response/outcome";
import { readVersion } from "@repo/backend/confect/tryouts/response/version";
import { readTryoutSectionContentAccess } from "@repo/backend/confect/tryouts/runtime/content";
import { loadSectionPlacements } from "@repo/backend/confect/tryouts/runtime/placement";
import {
  loadSectionResponseIndex,
  type TryoutResponseIndex,
} from "@repo/backend/confect/tryouts/runtime/response";
import { projectTryoutSignedContent } from "@repo/backend/confect/tryouts/runtime/selectors";
import { noTryoutSectionContentAccess } from "@repo/backend/confect/tryouts/runtime/spec";
import { getSectionScoreResult } from "@repo/backend/confect/tryouts/score/result";
import { Array as Arr, Effect, HashSet, MutableHashMap, Option } from "effect";

type TryoutPlacement = Docs["tryoutAttemptPlacements"];
type TryoutResponse = Docs["tryoutResponses"];

/** Projects the public state shared by attempt and runtime responses. */
const readCurrentSection = Effect.fn("tryouts.runtime.readCurrentSection")(
  function* (section: Docs["tryoutSectionAttempts"]) {
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
  }
);

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

/**
 * The placements that the learner flagged for review in the attempt, read by the attempt's prefix of the
 * shared flags index (ADR 0031). An attempt holds at most one flag per question, so its question count
 * bounds the read.
 */
const loadFlaggedPlacements = Effect.fn(
  "tryouts.runtime.loadFlaggedPlacements"
)(function* (attempt: Docs["tryoutAttempts"]) {
  const flags = yield* (yield* DatabaseReader)
    .table("assessmentFlags")
    .index("by_attempt_and_question", (query) =>
      query.eq("attempt", attempt._id)
    )
    .take(attempt.totalQuestions)
    .pipe(Effect.orDie);
  return HashSet.fromIterable(Arr.map(flags, (flag) => flag.question));
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
          yield* loadFlaggedPlacements(attempt),
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
  responses: TryoutResponseIndex["responses"],
  flagged: HashSet.HashSet<string>,
  access: {
    readonly answers: boolean;
    readonly questions: boolean;
  }
) {
  const responsesByPlacement = MutableHashMap.fromIterable(
    Arr.map(responses, (response) => [response.placementId, response])
  );
  return Arr.map(placements, (placement) =>
    projectRuntimeQuestion(
      placement,
      Option.getOrNull(MutableHashMap.get(responsesByPlacement, placement._id)),
      HashSet.has(flagged, placement._id),
      access
    )
  );
}

/** Projects one validated frozen placement and optional learner response. */
function projectRuntimeQuestion(
  placement: TryoutPlacement,
  response: TryoutResponse | null,
  flagged: boolean,
  access: {
    readonly answers: boolean;
    readonly questions: boolean;
  }
) {
  const runtimeResponse = response
    ? {
        answeredAt: response.answeredAt,
        isComplete: response.isComplete,
        ...(access.answers ? { outcome: readOutcome(response) } : {}),
        selection: projectSelection(response.selection, access.answers),
        updatedAt: response.updatedAt,
      }
    : null;
  const version = readVersion(placement, Option.fromNullOr(response));
  return {
    contentHash: placement.contentHash,
    flagged,
    placementId: placement._id,
    questionOrder: placement.questionOrder,
    response: runtimeResponse,
    responseSpec: project(placement.responseSpec, access.answers),
    sourcePath: placement.sourcePath,
    sourceRevision: placement.sourceRevision,
    ...(Option.isSome(version) ? { version: version.value } : {}),
  };
}
