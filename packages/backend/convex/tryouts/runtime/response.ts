import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  indexTryoutResponses,
  requireTryoutResponseSectionSnapshot,
  TryoutResponseIntegrityError,
  validateTryoutResponsePlacementInventory,
} from "@repo/backend/convex/tryouts/response/integrity";
import { tryRuntimePromise } from "@repo/backend/convex/tryouts/runtime/error";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutPlacement = Doc<"tryoutAttemptPlacements">;
type TryoutResponse = Doc<"tryoutResponses">;
type TryoutSectionAttempt = Doc<"tryoutSectionAttempts">;
type TryoutReadContext = Pick<QueryCtx, "db">;
type SectionCoverage = "complete" | "partial";

interface ResponsePlacementLink {
  readonly placement: TryoutPlacement;
  readonly sectionAttemptId: Id<"tryoutSectionAttempts">;
}

export interface TryoutResponseIndex {
  readonly placements: TryoutPlacement[];
  readonly responses: ReadonlyMap<
    Id<"tryoutAttemptPlacements">,
    TryoutResponse
  >;
}

export interface TryoutAttemptResponseIndex extends TryoutResponseIndex {
  readonly sections: TryoutSectionAttempt[];
}

/** Loads one section response graph from an already-read placement inventory. */
export const loadSectionResponseIndex = Effect.fn(
  "tryouts.response.loadSectionIntegrity"
)(function* (
  ctx: TryoutReadContext,
  attempt: TryoutAttempt,
  section: TryoutSectionAttempt,
  placements: TryoutPlacement[]
) {
  const snapshot = yield* requireTryoutResponseSectionSnapshot(
    attempt,
    section
  );
  const responses = yield* tryRuntimePromise(() =>
    ctx.db
      .query("tryoutResponses")
      .withIndex("by_tryoutSectionAttemptId_and_answeredAt", (index) =>
        index.eq("tryoutSectionAttemptId", section._id)
      )
      .take(section.totalQuestions + 1)
  );
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
  const links = validatedPlacements.map((placement) => ({
    placement,
    sectionAttemptId: section._id,
  }));
  const indexed = yield* indexTryoutResponses({
    attemptId: attempt._id,
    links,
    responses,
  });
  return { placements: validatedPlacements, responses: indexed };
});

/** Loads one bounded attempt response graph with complete or partial coverage. */
export const loadAttemptResponses = Effect.fn(
  "tryouts.response.loadAttemptIntegrity"
)(function* (
  ctx: TryoutReadContext,
  attempt: TryoutAttempt,
  placements: TryoutPlacement[],
  sectionCoverage: SectionCoverage
) {
  const { responses, sections } = yield* Effect.all(
    {
      responses: tryRuntimePromise(() =>
        ctx.db
          .query("tryoutResponses")
          .withIndex("by_tryoutAttemptId_and_answeredAt", (index) =>
            index.eq("tryoutAttemptId", attempt._id)
          )
          .take(attempt.totalQuestions + 1)
      ),
      sections: tryRuntimePromise(() =>
        ctx.db
          .query("tryoutSectionAttempts")
          .withIndex("by_tryoutAttemptId_and_sectionOrder", (index) =>
            index.eq("tryoutAttemptId", attempt._id)
          )
          .take(attempt.sectionSnapshots.length + 1)
      ),
    },
    { concurrency: "unbounded" }
  );
  if (responses.length > attempt.totalQuestions) {
    return yield* responseIntegrity(
      "TRYOUT_RESPONSE_COUNT_EXCEEDED",
      "Try-out response count exceeds the attempt question count."
    );
  }

  const validatedPlacements = yield* validateTryoutResponsePlacementInventory({
    attemptId: attempt._id,
    expectedQuestionCount: attempt.totalQuestions,
    placements,
    snapshots: attempt.sectionSnapshots,
  });
  const sectionsByIdentity = yield* indexAttemptSections(
    attempt,
    sections,
    sectionCoverage
  );
  const links: ResponsePlacementLink[] = [];
  for (const placement of validatedPlacements) {
    const section = sectionsByIdentity.get(placement.sectionIdentity);
    if (!section) {
      continue;
    }
    if (section.sectionKey !== placement.sectionKey) {
      return yield* responseIntegrity(
        "TRYOUT_RESPONSE_LINK_MISMATCH",
        "Try-out placement differs from its section attempt."
      );
    }
    links.push({ placement, sectionAttemptId: section._id });
  }
  const indexed = yield* indexTryoutResponses({
    attemptId: attempt._id,
    links,
    responses,
  });
  return { placements: validatedPlacements, responses: indexed, sections };
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
      const snapshot = attempt.sectionSnapshots.find(
        (candidate) => candidate.sectionIdentity === section.sectionIdentity
      );
      if (
        !snapshot ||
        sectionsByIdentity.has(section.sectionIdentity) ||
        section.tryoutAttemptId !== attempt._id ||
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
  return new TryoutResponseIntegrityError({ code, message });
}
