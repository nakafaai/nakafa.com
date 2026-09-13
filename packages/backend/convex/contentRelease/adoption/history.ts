import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import type { AdoptionHistory } from "@repo/backend/convex/contentRelease/adoption/spec";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { convexToJson } from "convex/values";
import { Effect } from "effect";

/** Uses the native Convex canonical field order, including every private learner value. */
export const hashHistory = Effect.fn("contentRelease.adoption.hashHistory")(
  (history: AdoptionHistory) =>
    hashText(
      "adoption history",
      JSON.stringify(
        convexToJson({
          entries: history.entries
            .map((entry) => ({
              ...entry,
              placements: [...entry.placements].sort(byId),
              responses: [...entry.responses].sort(byId),
              scores: [...entry.scores].sort(byId),
              sections: [...entry.sections].sort(byId),
            }))
            .sort((left, right) => byId(left.attempt, right.attempt)),
          scaleEntries: history.scaleEntries
            .map((entry) => ({
              ...entry,
              items: [...entry.items].sort(byId),
            }))
            .sort((left, right) => byId(left.scale, right.scale)),
        })
      )
    )
);

function byId(left: { _id: string }, right: { _id: string }) {
  if (left._id === right._id) {
    return 0;
  }
  return left._id < right._id ? -1 : 1;
}

/** Bounds reads to the measured three completed attempts and one 160-item scale. */
export const readHistory = Effect.fn("contentRelease.adoption.readHistory")(
  function* (ctx: QueryCtx | MutationCtx, snapshotId: string) {
    const attempts = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_tryoutSnapshotId", (q) =>
          q.eq("tryoutSnapshotId", snapshotId)
        )
        .take(4)
    );
    const scales = yield* Effect.promise(() =>
      ctx.db
        .query("irtScaleVersions")
        .withIndex("by_tryoutSnapshotId_and_setIdentity_and_publishedAt", (q) =>
          q.eq("tryoutSnapshotId", snapshotId)
        )
        .take(2)
    );
    if (attempts.length === 0 || attempts.length > 3 || scales.length > 1) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        "Retained history inventory changed or exceeds its reviewed bounds."
      );
    }
    const entries: AdoptionHistory["entries"] = [];
    for (const attempt of attempts) {
      if (attempt.status !== "completed" || attempt.completedAt === null) {
        return yield* releaseFail(
          "CONTENT_RELEASE_CONFLICT",
          "Adoption requires completed attempts."
        );
      }
      const placements = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutAttemptPlacements")
          .withIndex("by_tryoutAttemptId_and_questionOrder", (q) =>
            q.eq("tryoutAttemptId", attempt._id)
          )
          .take(161)
      );
      const responses = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutResponses")
          .withIndex("by_tryoutAttemptId_and_answeredAt", (q) =>
            q.eq("tryoutAttemptId", attempt._id)
          )
          .take(161)
      );
      const sections = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutSectionAttempts")
          .withIndex("by_tryoutAttemptId_and_sectionOrder", (q) =>
            q.eq("tryoutAttemptId", attempt._id)
          )
          .take(8)
      );
      const scores = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutScores")
          .withIndex("by_tryoutAttemptId", (q) =>
            q.eq("tryoutAttemptId", attempt._id)
          )
          .take(2)
      );
      if (
        placements.length !== attempt.totalQuestions ||
        placements.length > 160 ||
        responses.length > 160 ||
        sections.length !== attempt.sectionSnapshots.length ||
        sections.length > 7 ||
        scores.length !== 1 ||
        sections.some((section) => section.status !== "completed") ||
        scores.some((score) => score.tryoutSnapshotId !== snapshotId)
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_CONFLICT",
          "Retained attempt membership or scoring inventory changed."
        );
      }
      entries.push({ attempt, placements, responses, sections, scores });
    }
    const scaleEntries: AdoptionHistory["scaleEntries"] = [];
    for (const scale of scales) {
      const items = yield* Effect.promise(() =>
        ctx.db
          .query("irtScaleItems")
          .withIndex("by_scaleVersionId_and_placementIdentity", (q) =>
            q.eq("scaleVersionId", scale._id)
          )
          .take(161)
      );
      const owners = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutAttempts")
          .withIndex("by_scaleVersionId", (q) =>
            q.eq("scaleVersionId", scale._id)
          )
          .take(4)
      );
      const scores = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutScores")
          .withIndex("by_scaleVersionId", (q) =>
            q.eq("scaleVersionId", scale._id)
          )
          .take(4)
      );
      if (
        items.length !== scale.questionCount ||
        items.length > 160 ||
        owners.length > 3 ||
        owners.some(
          (owner) => !attempts.some((attempt) => attempt._id === owner._id)
        ) ||
        scores.length > 3 ||
        scores.some(
          (score) =>
            !attempts.some((attempt) => attempt._id === score.tryoutAttemptId)
        )
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_CONFLICT",
          "Retained scale acquired unreviewed readers or items."
        );
      }
      scaleEntries.push({ scale, items });
    }
    if (
      entries.some(({ attempt, scores }) =>
        [
          attempt.scaleVersionId,
          ...scores.map((score) => score.scaleVersionId),
        ].some(
          (id) => id !== undefined && !scales.some((scale) => scale._id === id)
        )
      )
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        "Retained attempt references a scale outside this snapshot."
      );
    }
    return { entries, scaleEntries };
  }
);
