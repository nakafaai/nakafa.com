import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  indexTryoutResponses,
  requireTryoutResponseSectionSnapshot,
  TryoutResponseIntegrityError,
  validateTryoutResponsePlacements,
} from "@repo/backend/convex/tryouts/response/integrity";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutPlacement = Doc<"tryoutAttemptPlacements">;
type TryoutSectionAttempt = Doc<"tryoutSectionAttempts">;
type TryoutReadContext = Pick<QueryCtx, "db">;

interface ResponsePlacementLink {
  readonly placement: TryoutPlacement;
  readonly sectionAttemptId: Id<"tryoutSectionAttempts">;
}

/** Loads one section response graph through exact placement ownership. */
export const loadSectionResponseIndex = Effect.fn(
  "tryouts.response.loadSectionIntegrity"
)(function* (
  ctx: TryoutReadContext,
  attempt: TryoutAttempt,
  section: TryoutSectionAttempt
) {
  const snapshot = yield* requireTryoutResponseSectionSnapshot(
    attempt,
    section
  );

  const { placements, responses } = yield* Effect.all(
    {
      placements: Effect.promise(() =>
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
      ),
      responses: Effect.promise(() =>
        ctx.db
          .query("tryoutResponses")
          .withIndex("by_tryoutSectionAttemptId_and_answeredAt", (index) =>
            index.eq("tryoutSectionAttemptId", section._id)
          )
          .take(section.totalQuestions + 1)
      ),
    },
    { concurrency: "unbounded" }
  );
  if (placements.length !== section.totalQuestions) {
    return yield* responseIntegrity(
      "TRYOUT_PLACEMENT_COUNT_MISMATCH",
      "Try-out placement count does not match its snapshot count."
    );
  }
  if (responses.length > section.totalQuestions) {
    return yield* responseIntegrity(
      "TRYOUT_RESPONSE_COUNT_EXCEEDED",
      "Try-out response count exceeds the section question count."
    );
  }

  const links = placements.map((placement) => ({
    placement,
    sectionAttemptId: section._id,
  }));
  yield* validateTryoutResponsePlacements(attempt._id, snapshot, placements);
  const indexed = yield* indexTryoutResponses({
    attemptId: attempt._id,
    links,
    responses,
  });
  return { placements, responses: indexed };
});

/** Loads terminal responses with one attempt-index query and bounded joins. */
export const loadAttemptResponses = Effect.fn(
  "tryouts.response.loadAttemptIntegrity"
)(function* (ctx: TryoutReadContext, attempt: TryoutAttempt) {
  const { placements, responses, sections } = yield* Effect.all(
    {
      placements: Effect.promise(() =>
        ctx.db
          .query("tryoutAttemptPlacements")
          .withIndex("by_tryoutAttemptId_and_questionOrder", (index) =>
            index.eq("tryoutAttemptId", attempt._id)
          )
          .take(attempt.totalQuestions + 1)
      ),
      responses: Effect.promise(() =>
        ctx.db
          .query("tryoutResponses")
          .withIndex("by_tryoutAttemptId_and_answeredAt", (index) =>
            index.eq("tryoutAttemptId", attempt._id)
          )
          .take(attempt.totalQuestions + 1)
      ),
      sections: Effect.promise(() =>
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
  if (placements.length !== attempt.totalQuestions) {
    return yield* responseIntegrity(
      "TRYOUT_PLACEMENT_COUNT_MISMATCH",
      "Try-out placement count does not match the attempt snapshot."
    );
  }
  if (responses.length > attempt.totalQuestions) {
    return yield* responseIntegrity(
      "TRYOUT_RESPONSE_COUNT_EXCEEDED",
      "Try-out response count exceeds the attempt question count."
    );
  }

  const sectionsByIdentity = yield* indexAttemptSections(attempt, sections);
  const links: ResponsePlacementLink[] = [];
  for (const placement of placements) {
    const section = sectionsByIdentity.get(placement.sectionIdentity);
    if (!section || section.sectionKey !== placement.sectionKey) {
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
  return [...indexed.values()];
});

/** Validates every section attempt against its exact frozen section row. */
const indexAttemptSections = Effect.fn("tryouts.response.indexAttemptSections")(
  function* (
    attempt: TryoutAttempt,
    sections: readonly TryoutSectionAttempt[]
  ) {
    if (sections.length !== attempt.sectionSnapshots.length) {
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
