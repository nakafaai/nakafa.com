import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { identityFailure } from "@repo/backend/convex/tryouts/migrations/spec";
import { v } from "convex/values";
import { Effect } from "effect";

/** Exact durable table counts required before identity migration. */
export interface TryoutIdentityCounts {
  readonly attempts: number;
  readonly placements: number;
  readonly progress: number;
  readonly responses: number;
  readonly scores: number;
  readonly sections: number;
}

const auditLimits: TryoutIdentityCounts = {
  attempts: 100,
  placements: 2000,
  progress: 100,
  responses: 2000,
  scores: 100,
  sections: 500,
};

/** Audits every bounded durable try-out relation before migration. */
export const auditTryoutIdentity = Effect.fn(
  "tryouts.migrations.auditTryoutIdentity"
)(function* (ctx: QueryCtx, expected: TryoutIdentityCounts) {
  const [attempts, progress, sections, placements, responses, scores] =
    yield* Effect.all([
      readExact(
        () => ctx.db.query("tryoutAttempts").take(expected.attempts + 1),
        expected.attempts,
        auditLimits.attempts,
        "attempts"
      ),
      readExact(
        () => ctx.db.query("tryoutSetProgress").take(expected.progress + 1),
        expected.progress,
        auditLimits.progress,
        "progress"
      ),
      readExact(
        () => ctx.db.query("tryoutSectionAttempts").take(expected.sections + 1),
        expected.sections,
        auditLimits.sections,
        "sections"
      ),
      readExact(
        () =>
          ctx.db.query("tryoutAttemptPlacements").take(expected.placements + 1),
        expected.placements,
        auditLimits.placements,
        "placements"
      ),
      readExact(
        () => ctx.db.query("tryoutResponses").take(expected.responses + 1),
        expected.responses,
        auditLimits.responses,
        "responses"
      ),
      readExact(
        () => ctx.db.query("tryoutScores").take(expected.scores + 1),
        expected.scores,
        auditLimits.scores,
        "scores"
      ),
    ]);
  const attemptById = new Map(
    attempts.map((attempt) => [String(attempt._id), attempt])
  );
  const sectionById = new Map(
    sections.map((section) => [String(section._id), section])
  );
  const placementById = new Map(
    placements.map((placement) => [String(placement._id), placement])
  );

  for (const progressRow of progress) {
    const attempt = attemptById.get(String(progressRow.latestAttemptId));
    if (
      !attempt ||
      attempt.userId !== progressRow.userId ||
      attempt.tryoutSetId !== progressRow.tryoutSetId
    ) {
      return yield* invalidRelation("progress", progressRow._id);
    }
  }
  for (const section of sections) {
    const attempt = attemptById.get(String(section.tryoutAttemptId));
    const snapshot = attempt?.sectionSnapshots.find(
      (candidate) => candidate.sectionKey === section.sectionKey
    );
    if (
      !(attempt && snapshot) ||
      snapshot.tryoutSectionId !== section.tryoutSectionId
    ) {
      return yield* invalidRelation("section", section._id);
    }
  }
  for (const placement of placements) {
    const attempt = attemptById.get(String(placement.tryoutAttemptId));
    const snapshot = attempt?.sectionSnapshots.find(
      (candidate) => candidate.tryoutSectionId === placement.tryoutSectionId
    );
    if (!(attempt && snapshot)) {
      return yield* invalidRelation("placement", placement._id);
    }
  }
  for (const response of responses) {
    const attempt = attemptById.get(String(response.tryoutAttemptId));
    const section = sectionById.get(String(response.tryoutSectionAttemptId));
    const placement = placementById.get(String(response.placementId));
    if (
      !(attempt && section && placement) ||
      section.tryoutAttemptId !== attempt._id ||
      placement.tryoutAttemptId !== attempt._id ||
      placement.questionId !== response.questionId
    ) {
      return yield* invalidRelation("response", response._id);
    }
  }
  for (const score of scores) {
    const attempt = attemptById.get(String(score.tryoutAttemptId));
    if (
      !attempt ||
      attempt.userId !== score.userId ||
      attempt.tryoutSetId !== score.tryoutSetId
    ) {
      return yield* invalidRelation("score", score._id);
    }
  }
  return {
    counts: expected,
    missing: {
      attempts: attempts.filter(
        (attempt) => attempt.tryoutSnapshotId === undefined
      ).length,
      placements: placements.filter(
        (placement) => placement.placementIdentity === undefined
      ).length,
      progress: progress.filter((row) => row.setIdentity === undefined).length,
    },
  };
});

/** Exposes the read-only exact audit through an internal operator query. */
export const audit = internalQuery({
  args: {
    attempts: v.number(),
    placements: v.number(),
    progress: v.number(),
    responses: v.number(),
    scores: v.number(),
    sections: v.number(),
  },
  handler: (ctx, args) => runConvexProgram(auditTryoutIdentity(ctx, args)),
  returns: v.object({
    counts: v.object({
      attempts: v.number(),
      placements: v.number(),
      progress: v.number(),
      responses: v.number(),
      scores: v.number(),
      sections: v.number(),
    }),
    missing: v.object({
      attempts: v.number(),
      placements: v.number(),
      progress: v.number(),
    }),
  }),
});

/** Reads and proves one exact bounded table count. */
const readExact = Effect.fn("tryouts.migrations.readExact")(function* <Row>(
  read: () => Promise<Row[]>,
  expected: number,
  maximum: number,
  label: string
) {
  if (!Number.isSafeInteger(expected) || expected < 0 || expected > maximum) {
    return yield* identityFailure(
      "TRYOUT_IDENTITY_EXPECTATION_INVALID",
      `Expected ${label} count must be a safe integer from 0-${maximum}.`
    );
  }
  const rows = yield* Effect.promise(read);
  if (rows.length !== expected) {
    return yield* identityFailure(
      "TRYOUT_IDENTITY_COUNT_MISMATCH",
      `Expected ${expected} ${label} rows but found ${rows.length}.`
    );
  }
  return rows;
});

/** Builds one typed relation failure without exposing row contents. */
function invalidRelation(label: string, id: { toString(): string }) {
  return identityFailure(
    "TRYOUT_IDENTITY_RELATION_INVALID",
    `Durable ${label} ${id} has an invalid parent relation.`
  );
}
