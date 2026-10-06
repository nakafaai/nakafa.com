import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  indexTryoutResponses,
  requireTryoutResponseSectionSnapshot,
  validateTryoutResponsePlacementInventory,
} from "@repo/backend/confect/tryouts/response/integrity";
import { TryoutResponseIntegrityError } from "@repo/backend/confect/tryouts/response/spec";
import { toTryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect, Option } from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];
type TryoutPlacement = Docs["tryoutAttemptPlacements"];
type TryoutResponse = Docs["tryoutResponses"];
type TryoutSectionAttempt = Docs["tryoutSectionAttempts"];
type SectionCoverage = "complete" | "partial";
interface ResponsePlacementLink {
  readonly placement: TryoutPlacement;
  readonly sectionAttemptId: Id<"tryoutSectionAttempts">;
}
export interface TryoutResponseIndex {
  readonly placements: readonly TryoutPlacement[];
  readonly responses: ReadonlyMap<
    Id<"tryoutAttemptPlacements">,
    TryoutResponse
  >;
}
export interface TryoutAttemptResponseIndex extends TryoutResponseIndex {
  readonly sections: readonly TryoutSectionAttempt[];
}

/** Loads one section response graph from an already-read placement inventory. */
export const loadSectionResponseIndex = Effect.fn(
  "tryouts.response.loadSectionIntegrity"
)(function* (
  attempt: TryoutAttempt,
  section: TryoutSectionAttempt,
  placements: readonly TryoutPlacement[]
) {
  const database = yield* DatabaseReader;
  const snapshot = yield* requireTryoutResponseSectionSnapshot(
    attempt,
    section
  );
  const responses = yield* database
    .table("tryoutResponses")
    .index("by_tryoutSectionAttemptId_and_answeredAt", (index) =>
      index.eq("tryoutSectionAttemptId", section._id)
    )
    .take(section.totalQuestions + 1)
    .pipe(Effect.mapError(toTryoutRuntimeError));
  if (responses.length > section.totalQuestions) {
    return yield* responseIntegrity(
      "TRYOUT_RESPONSE_COUNT_EXCEEDED",
      "Try-out response count exceeds the section question count."
    );
  }
  const validatedPlacements = yield* validateTryoutResponsePlacementInventory({
    attemptId: attempt._id,
    expectedQuestionCount: snapshot.questionCount,
    placements,
    snapshots: [snapshot],
  });
  const links = Arr.map(validatedPlacements, (placement) => ({
    placement,
    sectionAttemptId: section._id,
  }));
  const indexed = yield* indexTryoutResponses({
    attemptId: attempt._id,
    links,
    responses,
  });
  return {
    placements: validatedPlacements,
    responses: indexed,
  };
});

/** Loads one bounded attempt response graph with complete or partial coverage. */
export const loadAttemptResponses = Effect.fn(
  "tryouts.response.loadAttemptIntegrity"
)(function* (
  attempt: TryoutAttempt,
  placements: readonly TryoutPlacement[],
  sectionCoverage: SectionCoverage
) {
  const database = yield* DatabaseReader;
  const validatedPlacements = yield* validateTryoutResponsePlacementInventory({
    attemptId: attempt._id,
    expectedQuestionCount: attempt.totalQuestions,
    placements,
    snapshots: attempt.sectionSnapshots,
  });
  const { responses, sections } = yield* Effect.all(
    {
      responses: database
        .table("tryoutResponses")
        .index("by_tryoutAttemptId_and_answeredAt", (index) =>
          index.eq("tryoutAttemptId", attempt._id)
        )
        .take(attempt.totalQuestions + 1)
        .pipe(Effect.mapError(toTryoutRuntimeError)),
      sections: database
        .table("tryoutSectionAttempts")
        .index("by_tryoutAttemptId_and_sectionOrder", (index) =>
          index.eq("tryoutAttemptId", attempt._id)
        )
        .take(attempt.sectionSnapshots.length + 1)
        .pipe(Effect.mapError(toTryoutRuntimeError)),
    },
    {
      concurrency: "unbounded",
    }
  );
  if (responses.length > attempt.totalQuestions) {
    return yield* responseIntegrity(
      "TRYOUT_RESPONSE_COUNT_EXCEEDED",
      "Try-out response count exceeds the attempt question count."
    );
  }
  const sectionsByIdentity = yield* indexAttemptSections(
    attempt,
    sections,
    sectionCoverage
  );
  let links: ResponsePlacementLink[] = [];
  for (const placement of validatedPlacements) {
    const section = sectionsByIdentity.get(placement.sectionIdentity);
    if (!section) {
      continue;
    }
    links = Arr.append(links, {
      placement,
      sectionAttemptId: section._id,
    });
  }
  const indexed = yield* indexTryoutResponses({
    attemptId: attempt._id,
    links,
    responses,
  });
  return {
    placements: validatedPlacements,
    responses: indexed,
    sections,
  };
});

/** Validates section attempts against exact frozen section rows. */
const indexAttemptSections = Effect.fn("tryouts.response.indexAttemptSections")(
  function* (
    attempt: TryoutAttempt,
    sections: readonly TryoutSectionAttempt[],
    sectionCoverage: SectionCoverage
  ) {
    if (sections.length > attempt.sectionSnapshots.length) {
      return yield* responseIntegrity(
        "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
        "Try-out section attempt count exceeds its frozen snapshot."
      );
    }
    if (
      sectionCoverage === "complete" &&
      sections.length !== attempt.sectionSnapshots.length
    ) {
      return yield* responseIntegrity(
        "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
        "Try-out section attempts do not match the frozen section count."
      );
    }
    const sectionsByIdentity = new Map<string, TryoutSectionAttempt>();
    for (const section of sections) {
      const snapshot = Option.getOrUndefined(
        Arr.findFirst(
          attempt.sectionSnapshots,
          (candidate) => candidate.sectionIdentity === section.sectionIdentity
        )
      );
      if (
        !snapshot ||
        sectionsByIdentity.has(section.sectionIdentity) ||
        section.sectionKey !== snapshot.sectionKey ||
        section.sectionOrder !== snapshot.sectionOrder ||
        section.totalQuestions !== snapshot.questionCount
      ) {
        return yield* responseIntegrity(
          "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
          "Try-out section attempt differs from its frozen snapshot."
        );
      }
      sectionsByIdentity.set(section.sectionIdentity, section);
    }
    return sectionsByIdentity;
  }
);

/** Creates one typed fail-closed response graph error. */
function responseIntegrity(
  code: TryoutResponseIntegrityError["code"],
  message: string
) {
  return new TryoutResponseIntegrityError({
    code,
    message,
  });
}
