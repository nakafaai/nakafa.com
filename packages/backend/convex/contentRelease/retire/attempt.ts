import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { cleanupAttemptRuntime } from "@repo/backend/convex/auth/cleanup/tryouts";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadRetiredRelease } from "@repo/backend/convex/contentRelease/retire/history";
import type { retirementAttemptValidator } from "@repo/backend/convex/contentRelease/retire/spec";
import { readTryoutRuntimeRetention } from "@repo/backend/convex/contentRelease/tryout/runtime";
import type { Infer } from "convex/values";
import { Effect } from "effect";

/** Deletes one bounded page belonging only to an exact reviewed unpaid attempt. */
export const retireAttemptPage = Effect.fn("contentRelease.retireAttemptPage")(
  function* (ctx: MutationCtx, plan: Infer<typeof retirementAttemptValidator>) {
    const [runtime, attempt] = yield* Effect.all([
      Effect.promise(() => ctx.db.get("tryoutRuntimeBundles", plan.runtimeId)),
      Effect.promise(() => ctx.db.get("tryoutAttempts", plan.attemptId)),
    ]);
    if (!(runtime || attempt)) {
      return { complete: true };
    }
    if (
      !runtime ||
      runtime.bundleHash !== plan.bundleHash ||
      runtime.sourceReleaseId !== plan.source.releaseId ||
      runtime.sourceManifestHash !== plan.source.manifestHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "The reviewed try-out runtime changed identity."
      );
    }
    yield* loadRetiredRelease(ctx, plan.source);
    const retention = yield* readTryoutRuntimeRetention(ctx, runtime);
    if (retention.retainingReleaseId !== null) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        "An active publication slot still owns the reviewed runtime."
      );
    }
    const attempts = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_tryoutBundleId", (query) =>
          query.eq("tryoutBundleId", runtime._id)
        )
        .take(2)
    );
    if (attempts.some((row) => row._id !== plan.attemptId)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        "Another try-out attempt still owns the reviewed runtime."
      );
    }
    if (!attempt) {
      yield* Effect.promise(() =>
        ctx.db.delete("tryoutRuntimeBundles", runtime._id)
      );
      return { complete: true };
    }
    if (
      attempt.tryoutBundleId !== runtime._id ||
      attempt.tryoutBundleHash !== plan.bundleHash ||
      attempt.tryoutSnapshotId !== runtime.snapshotId ||
      attempt.snapshotReleaseId !== plan.source.releaseId ||
      attempt.status !== "completed" ||
      attempt.startedAt !== plan.startedAt ||
      attempt.accessSubscriptionId !== undefined ||
      attempt.accessSourceKind !== "free" ||
      attempt.countsForCompetition
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "The reviewed attempt is no longer the same completed unpaid snapshot."
      );
    }
    const progress = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutSetProgress")
        .withIndex("by_userId_and_setIdentity", (query) =>
          query
            .eq("userId", attempt.userId)
            .eq("setIdentity", attempt.setIdentity)
        )
        .unique()
    );
    if (progress?.latestAttemptId === attempt._id) {
      const siblings = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutAttempts")
          .withIndex("by_userId_and_setIdentity_and_startedAt", (query) =>
            query
              .eq("userId", attempt.userId)
              .eq("setIdentity", attempt.setIdentity)
          )
          .take(2)
      );
      if (siblings.some((row) => row._id !== attempt._id)) {
        return yield* releaseFail(
          "CONTENT_RELEASE_STATE",
          "The reviewed attempt still owns progress shared with another attempt."
        );
      }
      yield* Effect.promise(() =>
        ctx.db.delete("tryoutSetProgress", progress._id)
      );
    }
    yield* cleanupAttemptRuntime(ctx, attempt);
    return { complete: false };
  }
);
