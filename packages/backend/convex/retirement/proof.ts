import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  loadRelease,
  loadState,
} from "@repo/backend/convex/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { loadReleaseTryoutRuntime } from "@repo/backend/convex/contentRelease/tryout/runtime";
import {
  EmptyAttemptRetirementError,
  type Plan,
  requireProof,
  sameDocument,
} from "@repo/backend/convex/retirement/spec";
import { loadAttemptRuntimeBundle } from "@repo/backend/convex/tryouts/runtime/attempt/source";
import { getTryoutStatusRank } from "@repo/backend/convex/tryouts/status";
import { Effect, Option } from "effect";

/** Pins the already verified publication and its newly selectable runtime. */
const requirePublication = Effect.fn("retirement.requirePublication")(
  function* (ctx: MutationCtx, plan: Plan) {
    const state = yield* loadState(ctx);
    yield* requireProof(
      state?.activeReleaseId === plan.active.releaseId &&
        state.activeManifestHash === plan.active.manifestHash &&
        state.activeSequence === plan.active.sequence,
      "The reviewed Question publication is no longer active."
    );
    const release = yield* loadRelease(ctx, plan.active.releaseId);
    const signed = yield* decodeReleaseJson(release.releaseJson);
    yield* requireProof(
      release.status === "completed" &&
        release.sequence === plan.active.sequence &&
        signed.manifestHash === plan.active.manifestHash &&
        signed.manifest.snapshots.tryout.resultSnapshotId ===
          plan.newSnapshotId &&
        plan.newSnapshotId !== plan.attempt.tryoutSnapshotId,
      "The replacement signed try-out snapshot is not the reviewed active result."
    );
    const runtime = yield* loadReleaseTryoutRuntime(ctx, signed);
    yield* requireProof(
      runtime.result !== null &&
        runtime.result.stored.snapshotId === plan.newSnapshotId,
      "The replacement try-out runtime is unavailable."
    );
  }
);

/** Rechecks identity, activity and empty response/score indexes before each phase. */
export const requireEmptyAttempt = Effect.fn("retirement.requireEmptyAttempt")(
  function* (ctx: MutationCtx, plan: Plan) {
    const [attempt, response, score] = yield* Effect.all([
      Effect.promise(() => ctx.db.get("tryoutAttempts", plan.attempt._id)),
      Effect.promise(() =>
        ctx.db
          .query("tryoutResponses")
          .withIndex("by_tryoutAttemptId_and_answeredAt", (q) =>
            q.eq("tryoutAttemptId", plan.attempt._id)
          )
          .first()
      ),
      Effect.promise(() =>
        ctx.db
          .query("tryoutScores")
          .withIndex("by_tryoutAttemptId", (q) =>
            q.eq("tryoutAttemptId", plan.attempt._id)
          )
          .first()
      ),
    ]);
    yield* requireProof(
      attempt !== null && sameDocument(attempt, plan.attempt),
      "The reviewed attempt identity or activity changed."
    );
    yield* requireProof(
      response === null && score === null,
      "The reviewed attempt has a response or score."
    );
  }
);

/** Proves the exact bounded footprint and its completed predecessor before writes. */
export const inspectRetirement = Effect.fn("retirement.inspect")(function* (
  ctx: MutationCtx,
  plan: Plan
) {
  const attempt = plan.attempt;
  yield* requirePublication(ctx, plan);
  yield* requireEmptyAttempt(ctx, plan);
  yield* requireProof(
    attempt.countryKey === "indonesia" &&
      attempt.examKey === "snbt" &&
      attempt.trackKey === "2027" &&
      attempt.setKey === "set-1" &&
      attempt.appLocale === "id" &&
      attempt.attemptNumber === 5 &&
      attempt.status === "in-progress" &&
      attempt.totalQuestions === 160 &&
      attempt.totalCorrect === 0 &&
      sameDocument(attempt.completedSectionKeys, ["general-reasoning"]) &&
      attempt.completedAt === null &&
      attempt.endReason === null &&
      attempt.accessSourceKind === "subscription",
    "This is not the reviewed empty SNBT attempt."
  );
  const [sections, placements, progress, latest, previousScore, scale] =
    yield* Effect.all([
      Effect.promise(() =>
        ctx.db
          .query("tryoutSectionAttempts")
          .withIndex("by_tryoutAttemptId_and_sectionOrder", (q) =>
            q.eq("tryoutAttemptId", attempt._id)
          )
          .take(2)
      ),
      Effect.promise(() =>
        ctx.db
          .query("tryoutAttemptPlacements")
          .withIndex("by_tryoutAttemptId_and_questionOrder", (q) =>
            q.eq("tryoutAttemptId", attempt._id)
          )
          .take(161)
      ),
      Effect.promise(() =>
        ctx.db
          .query("tryoutSetProgress")
          .withIndex("by_userId_and_setIdentity", (q) =>
            q
              .eq("userId", attempt.userId)
              .eq("setIdentity", attempt.setIdentity)
          )
          .unique()
      ),
      Effect.promise(() =>
        ctx.db
          .query("tryoutAttempts")
          .withIndex("by_userId_and_setIdentity_and_startedAt", (q) =>
            q
              .eq("userId", attempt.userId)
              .eq("setIdentity", attempt.setIdentity)
          )
          .order("desc")
          .take(2)
      ),
      Effect.promise(() =>
        ctx.db
          .query("tryoutScores")
          .withIndex("by_tryoutAttemptId", (q) =>
            q.eq("tryoutAttemptId", plan.previous._id)
          )
          .unique()
      ),
      Effect.promise(() => ctx.db.get("irtScaleVersions", plan.scale._id)),
    ]);
  yield* requireProof(
    sections.length === 1 &&
      sameDocument(sections, [plan.section]) &&
      plan.section.status === "expired" &&
      plan.section.sectionKey === "general-reasoning" &&
      plan.section.answeredCount === 0 &&
      plan.section.correctAnswers === 0 &&
      plan.section.completedAt === attempt.lastActivityAt &&
      plan.section.endReason === "time-expired" &&
      plan.section.score?.rawScore === 0 &&
      plan.section.score.publishedScore === 100 &&
      plan.section.score.scoreStatus === "provisional",
    "The reviewed empty section changed."
  );
  yield* requireProof(
    placements.length === 160,
    "The reviewed frozen placement bound changed."
  );
  const sectionResponse = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutResponses")
      .withIndex("by_tryoutSectionAttemptId_and_answeredAt", (q) =>
        q.eq("tryoutSectionAttemptId", plan.section._id)
      )
      .first()
  );
  yield* requireProof(
    sectionResponse === null,
    "The reviewed section has a response."
  );
  for (const placement of placements) {
    const response = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutResponses")
        .withIndex("by_placementId", (q) => q.eq("placementId", placement._id))
        .first()
    );
    yield* requireProof(
      response === null,
      "A response still references a reviewed frozen placement."
    );
  }
  yield* requireProof(
    progress !== null &&
      sameDocument(progress, plan.progress) &&
      plan.progress.latestAttemptId === attempt._id &&
      plan.progress.status === "in-progress" &&
      plan.progress.publishedScore === null,
    "The reviewed latest progress changed."
  );
  yield* requireProof(
    sameDocument(latest, [attempt, plan.previous]) &&
      plan.previous.attemptNumber === 4 &&
      plan.previous.status === "completed",
    "The reviewed completed predecessor changed."
  );
  yield* requireProof(
    previousScore !== null &&
      sameDocument(previousScore, plan.previousScore) &&
      plan.previousScore.publishedScore === 100 &&
      plan.previousScore.userId === attempt.userId &&
      plan.previousScore.tryoutSnapshotId === plan.previous.tryoutSnapshotId &&
      plan.previousScore.setIdentity === attempt.setIdentity,
    "The reviewed predecessor score changed."
  );
  yield* requireProof(
    attempt.scaleVersionId === plan.scale._id &&
      scale !== null &&
      sameDocument(scale, plan.scale) &&
      plan.scale.history !== true &&
      plan.scale.status === "provisional" &&
      plan.scale.tryoutSnapshotId === attempt.tryoutSnapshotId &&
      plan.scale.setIdentity === attempt.setIdentity &&
      plan.scale.questionCount === 160,
    "The canonical scale retention proof changed."
  );
  yield* requireProof(
    plan.sharedAttempts.length === 3 &&
      new Set(plan.sharedAttempts.map((shared) => shared._id)).size === 3,
    "Three distinct completed shared TKA histories must remain protected."
  );
  for (const shared of plan.sharedAttempts) {
    const row = yield* Effect.promise(() =>
      ctx.db.get("tryoutAttempts", shared._id)
    );
    yield* requireProof(
      shared._id !== attempt._id &&
        shared.status === "completed" &&
        shared.examKey === "tka" &&
        shared.tryoutBundleId === attempt.tryoutBundleId &&
        shared.tryoutSnapshotId === attempt.tryoutSnapshotId &&
        row !== null &&
        sameDocument(row, shared),
      "A protected shared TKA history changed."
    );
    yield* loadAttemptRuntimeBundle(ctx, shared);
  }
});

/** Recognizes only the fully completed and still preserved retirement result. */
export const readCompletedRetirement = Effect.fn("retirement.readCompleted")(
  function* (ctx: MutationCtx, plan: Plan) {
    const attempt = yield* Effect.promise(() =>
      ctx.db.get("tryoutAttempts", plan.attempt._id)
    );
    if (attempt !== null) {
      return Option.none();
    }
    yield* requirePublication(ctx, plan);
    const [
      section,
      placement,
      response,
      score,
      oldProgress,
      progress,
      previous,
      previousScore,
      scale,
    ] = yield* Effect.all([
      Effect.promise(() =>
        ctx.db
          .query("tryoutSectionAttempts")
          .withIndex("by_tryoutAttemptId_and_sectionOrder", (q) =>
            q.eq("tryoutAttemptId", plan.attempt._id)
          )
          .first()
      ),
      Effect.promise(() =>
        ctx.db
          .query("tryoutAttemptPlacements")
          .withIndex("by_tryoutAttemptId_and_questionOrder", (q) =>
            q.eq("tryoutAttemptId", plan.attempt._id)
          )
          .first()
      ),
      Effect.promise(() =>
        ctx.db
          .query("tryoutResponses")
          .withIndex("by_tryoutAttemptId_and_answeredAt", (q) =>
            q.eq("tryoutAttemptId", plan.attempt._id)
          )
          .first()
      ),
      Effect.promise(() =>
        ctx.db
          .query("tryoutScores")
          .withIndex("by_tryoutAttemptId", (q) =>
            q.eq("tryoutAttemptId", plan.attempt._id)
          )
          .first()
      ),
      Effect.promise(() => ctx.db.get("tryoutSetProgress", plan.progress._id)),
      Effect.promise(() =>
        ctx.db
          .query("tryoutSetProgress")
          .withIndex("by_userId_and_setIdentity", (q) =>
            q
              .eq("userId", plan.attempt.userId)
              .eq("setIdentity", plan.attempt.setIdentity)
          )
          .unique()
      ),
      Effect.promise(() => ctx.db.get("tryoutAttempts", plan.previous._id)),
      Effect.promise(() => ctx.db.get("tryoutScores", plan.previousScore._id)),
      Effect.promise(() => ctx.db.get("irtScaleVersions", plan.scale._id)),
    ]);
    yield* requireProof(
      section === null &&
        placement === null &&
        response === null &&
        score === null &&
        oldProgress === null,
      "The prior retirement left an incomplete attempt footprint."
    );
    yield* requireProof(
      previous !== null &&
        sameDocument(previous, plan.previous) &&
        previousScore !== null &&
        sameDocument(previousScore, plan.previousScore) &&
        scale !== null &&
        sameDocument(scale, plan.scale),
      "The previously preserved predecessor or canonical scale changed."
    );
    for (const shared of plan.sharedAttempts) {
      const row = yield* Effect.promise(() =>
        ctx.db.get("tryoutAttempts", shared._id)
      );
      yield* requireProof(
        row !== null && sameDocument(row, shared),
        "A previously preserved shared history changed."
      );
      yield* loadAttemptRuntimeBundle(ctx, shared);
    }
    if (progress === null) {
      return yield* new EmptyAttemptRetirementError({
        code: "TRYOUT_EMPTY_RETIREMENT_REFUSED",
        message: "The prior retirement has no restored progress.",
      });
    }
    yield* requireProof(
      sameDocument(progress, {
        ...plan.progress,
        _id: progress._id,
        _creationTime: progress._creationTime,
        attemptNumber: plan.previous.attemptNumber,
        latestAttemptId: plan.previous._id,
        publishedScore: plan.previousScore.publishedScore,
        status: plan.previous.status,
        statusRank: getTryoutStatusRank(plan.previous.status),
        updatedAt: plan.previous.lastActivityAt,
      }),
      "The prior retirement progress changed."
    );
    return Option.some(progress._id);
  }
);
