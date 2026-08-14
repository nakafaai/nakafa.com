import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { rendererDomainValidator } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  historyFail,
  historyRead,
  type RetainedTryoutHistoryPlan,
  retainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/route";
import { tryoutChoiceSnapshotValidator } from "@repo/backend/convex/tryouts/runtime/choice";
import { tryoutStatusValidator } from "@repo/backend/convex/tryouts/status";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

const PAGE_BYTES = 2 * 1024 * 1024;
const PAGE_SIZE = 8;

const attemptValidator = v.object({
  _id: v.id("tryoutAttempts"),
  appLocale: v.optional(localeValidator),
  attemptNumber: v.number(),
  countryKey: tryoutRouteKeyValidator,
  examKey: tryoutRouteKeyValidator,
  locale: localeValidator,
  setIdentity: v.string(),
  setKey: tryoutRouteKeyValidator,
  snapshotReleaseId: v.string(),
  status: tryoutStatusValidator,
  totalQuestions: v.number(),
  trackKey: tryoutRouteKeyValidator,
  tryoutSnapshotId: v.string(),
  userId: v.id("users"),
});
const markerValidator = v.object({
  _id: v.id("tryoutAttemptHistory"),
  snapshotReleaseId: v.string(),
  tryoutAttemptId: v.id("tryoutAttempts"),
  tryoutSnapshotId: v.string(),
});
const progressValidator = v.object({
  _id: v.id("tryoutSetProgress"),
  appLocale: v.optional(localeValidator),
  attemptNumber: v.number(),
  countryKey: tryoutRouteKeyValidator,
  examKey: tryoutRouteKeyValidator,
  latestAttemptId: v.id("tryoutAttempts"),
  locale: localeValidator,
  setIdentity: v.string(),
  setKey: tryoutRouteKeyValidator,
  status: tryoutStatusValidator,
  trackKey: tryoutRouteKeyValidator,
  userId: v.id("users"),
});
const identityStateValidator = v.object({
  attempts: v.array(attemptValidator),
  markers: v.array(markerValidator),
  progressRows: v.array(progressValidator),
});
const bundleValidator = v.object({
  manifestHash: v.string(),
  releaseId: v.string(),
  releaseJson: v.string(),
  rendererJson: v.string(),
  snapshotId: v.string(),
});
const snapshotValidator = v.object({
  family: v.string(),
  snapshotId: v.string(),
  snapshotJson: v.string(),
  verifiedAt: v.optional(v.number()),
});
const signedStateValidator = v.object({
  bundles: v.array(bundleValidator),
  snapshot: v.union(v.null(), snapshotValidator),
});
const frozenPlacementValidator = v.object({
  _id: v.id("tryoutAttemptPlacements"),
  answerArtifactHash: v.string(),
  answerContentKey: v.string(),
  choiceSnapshots: v.array(tryoutChoiceSnapshotValidator),
  contentHash: v.string(),
  placementIdentity: v.string(),
  placementRowHash: v.string(),
  questionArtifactHash: v.string(),
  questionContentKey: v.string(),
  questionOrder: v.number(),
  rendererDomain: rendererDomainValidator,
  sectionIdentity: v.string(),
  sectionKey: tryoutRouteKeyValidator,
  sourcePath: v.string(),
  sourceRevision: v.string(),
  title: v.string(),
  tryoutAttemptId: v.id("tryoutAttempts"),
});
const frozenPageValidator = v.object({
  cursor: v.string(),
  done: v.boolean(),
  rows: v.array(frozenPlacementValidator),
});

export type TerminalAttempt = Infer<typeof attemptValidator>;
export type TerminalFrozenPlacement = Infer<typeof frozenPlacementValidator>;
export type TerminalFrozenPage = Infer<typeof frozenPageValidator>;
export type TerminalIdentityState = Infer<typeof identityStateValidator>;
export type TerminalProgress = Infer<typeof progressValidator>;
export type TerminalSignedState = Infer<typeof signedStateValidator>;

/** Reads every small attempt-owned identity family under explicit hard limits. */
export const identities = internalQuery({
  args: {},
  returns: identityStateValidator,
  handler: (ctx) =>
    runConvexProgram(readIdentities(ctx, retainedTryoutHistoryPlan)),
});

/** Reads exact retained signed bytes without scanning mutable publication state. */
export const signedState = internalQuery({
  args: {},
  returns: signedStateValidator,
  handler: (ctx) =>
    runConvexProgram(readSignedState(ctx, retainedTryoutHistoryPlan)),
});

/** Pages all attempt-owned frozen rows without a route or source fallback. */
export const frozenPage = internalQuery({
  args: { cursor: v.union(v.null(), v.string()) },
  returns: frozenPageValidator,
  handler: (ctx, args) => runConvexProgram(readFrozenPage(ctx, args.cursor)),
});

export const readIdentities = Effect.fn(
  "tryouts.history.readTerminalIdentities"
)(function* (ctx: QueryCtx, plan: RetainedTryoutHistoryPlan) {
  const [attempts, markers, progressRows] = yield* Effect.all([
    historyRead("Unable to read terminal retained attempts.", () =>
      ctx.db.query("tryoutAttempts").take(plan.attemptCount + 1)
    ),
    historyRead("Unable to read terminal history markers.", () =>
      ctx.db.query("tryoutAttemptHistory").take(plan.attemptCount + 1)
    ),
    historyRead("Unable to read terminal try-out progress.", () =>
      ctx.db.query("tryoutSetProgress").take(plan.progressCount + 1)
    ),
  ]);
  return {
    attempts: attempts.map((attempt) => ({
      _id: attempt._id,
      appLocale: attempt.appLocale,
      attemptNumber: attempt.attemptNumber,
      countryKey: attempt.countryKey,
      examKey: attempt.examKey,
      locale: attempt.locale,
      setIdentity: attempt.setIdentity,
      setKey: attempt.setKey,
      snapshotReleaseId: attempt.snapshotReleaseId,
      status: attempt.status,
      totalQuestions: attempt.totalQuestions,
      trackKey: attempt.trackKey,
      tryoutSnapshotId: attempt.tryoutSnapshotId,
      userId: attempt.userId,
    })),
    markers: markers.map((marker) => ({
      _id: marker._id,
      snapshotReleaseId: marker.snapshotReleaseId,
      tryoutAttemptId: marker.tryoutAttemptId,
      tryoutSnapshotId: marker.tryoutSnapshotId,
    })),
    progressRows: progressRows.map((progress) => ({
      _id: progress._id,
      appLocale: progress.appLocale,
      attemptNumber: progress.attemptNumber,
      countryKey: progress.countryKey,
      examKey: progress.examKey,
      latestAttemptId: progress.latestAttemptId,
      locale: progress.locale,
      setIdentity: progress.setIdentity,
      setKey: progress.setKey,
      status: progress.status,
      trackKey: progress.trackKey,
      userId: progress.userId,
    })),
  };
});

export const readSignedState = Effect.fn(
  "tryouts.history.readTerminalSignedState"
)(function* (ctx: QueryCtx, plan: RetainedTryoutHistoryPlan) {
  const [bundles, snapshot] = yield* Effect.all([
    historyRead("Unable to read terminal retained bundles.", () =>
      ctx.db.query("tryoutBundles").take(plan.releases.length + 1)
    ),
    historyRead("Unable to read terminal retained snapshot.", () =>
      ctx.db
        .query("contentSnapshots")
        .withIndex("by_family_and_snapshotId", (index) =>
          index.eq("family", "tryout").eq("snapshotId", plan.snapshotId)
        )
        .unique()
    ),
  ]);
  return {
    bundles: bundles.map((bundle) => ({
      manifestHash: bundle.manifestHash,
      releaseId: bundle.releaseId,
      releaseJson: bundle.releaseJson,
      rendererJson: bundle.rendererJson,
      snapshotId: bundle.snapshotId,
    })),
    snapshot: snapshot
      ? {
          family: snapshot.family,
          snapshotId: snapshot.snapshotId,
          snapshotJson: snapshot.snapshotJson,
          verifiedAt: snapshot.verifiedAt,
        }
      : null,
  };
});

export const readFrozenPage = Effect.fn(
  "tryouts.history.readTerminalFrozenPage"
)(function* (ctx: QueryCtx, cursor: null | string) {
  const page = yield* historyRead(
    "Unable to page terminal frozen placements.",
    () =>
      ctx.db.query("tryoutAttemptPlacements").paginate({
        cursor,
        maximumBytesRead: PAGE_BYTES,
        maximumRowsRead: PAGE_SIZE,
        numItems: PAGE_SIZE,
      })
  );
  const metrics = yield* historyRead(
    "Unable to read terminal frozen page metrics.",
    () => ctx.meta.getTransactionMetrics()
  );
  if (
    metrics.bytesRead.used > PAGE_BYTES ||
    metrics.databaseQueries.used > 1 ||
    metrics.documentsRead.used > PAGE_SIZE
  ) {
    return yield* historyFail(
      "TRYOUT_HISTORY_READ_FAILED",
      `Terminal frozen page used ${metrics.bytesRead.used} bytes, ${metrics.databaseQueries.used} queries, and ${metrics.documentsRead.used} documents.`
    );
  }
  return {
    cursor: page.continueCursor,
    done: page.isDone,
    rows: page.page.map((row) => ({
      _id: row._id,
      answerArtifactHash: row.answerArtifactHash,
      answerContentKey: row.answerContentKey,
      choiceSnapshots: row.choiceSnapshots,
      contentHash: row.contentHash,
      placementIdentity: row.placementIdentity,
      placementRowHash: row.placementRowHash,
      questionArtifactHash: row.questionArtifactHash,
      questionContentKey: row.questionContentKey,
      questionOrder: row.questionOrder,
      rendererDomain: row.rendererDomain,
      sectionIdentity: row.sectionIdentity,
      sectionKey: row.sectionKey,
      sourcePath: row.sourcePath,
      sourceRevision: row.sourceRevision,
      title: row.title,
      tryoutAttemptId: row.tryoutAttemptId,
    })),
  };
});
