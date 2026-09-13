import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { AdoptionCommit } from "@repo/backend/convex/contentRelease/adoption/spec";
import {
  hashAdoptionState,
  readAdoptionState,
} from "@repo/backend/convex/contentRelease/adoption/state";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

/** Requires unchanged candidate, learner state and authenticated artifact bytes. */
const verifyReadSet = Effect.fn("contentRelease.adoption.verifyReadSet")(
  function* (ctx: MutationCtx, input: AdoptionCommit) {
    const state = yield* readAdoptionState(ctx, input);
    if (
      state.historyHash !== input.expectedHistoryHash ||
      (yield* hashAdoptionState(state)) !== input.stateHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        "History or authenticated candidate changed before adoption."
      );
    }
    const required = new Set(
      state.placements.flatMap(({ prior, next }) => [
        prior.questionArtifactHash,
        prior.answerArtifactHash,
        next.questionArtifactHash,
        next.answerArtifactHash,
      ])
    );
    if (
      input.artifacts.length !== required.size ||
      new Set(input.artifacts.map((item) => item.artifactHash)).size !==
        required.size
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Adoption artifact evidence is incomplete or duplicated."
      );
    }
    for (const evidence of input.artifacts) {
      const artifact = yield* Effect.promise(() =>
        ctx.db
          .query("contentArtifacts")
          .withIndex("by_artifactHash", (q) =>
            q.eq("artifactHash", evidence.artifactHash)
          )
          .unique()
      );
      if (
        !(required.has(evidence.artifactHash) && artifact) ||
        (yield* hashText("adoption artifact bytes", artifact.artifactJson)) !==
          evidence.jsonHash
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_CONFLICT",
          "Authenticated historical artifact bytes changed."
        );
      }
    }
    return state;
  }
);

/** Applies only authenticated pointer changes in one database transaction. */
export const commitAdoption = Effect.fn("contentRelease.adoption.commit")(
  function* (ctx: MutationCtx, input: AdoptionCommit) {
    const state = yield* verifyReadSet(ctx, input);
    const byIdentity = new Map(
      state.placements.map((pair) => [pair.prior.identity, pair])
    );
    const receipt = {
      attempts: 0,
      placements: 0,
      scores: 0,
      scales: 0,
      scaleItems: 0,
    };
    for (const { attempt, placements, scores } of state.history.entries) {
      for (const frozen of placements) {
        const pair = byIdentity.get(frozen.placementIdentity);
        if (
          !pair ||
          frozen.placementRowHash !== pair.prior.rowHash ||
          frozen.questionArtifactHash !== pair.prior.questionArtifactHash ||
          frozen.answerArtifactHash !== pair.prior.answerArtifactHash
        ) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            "Frozen attempt no longer matches its original signed placement."
          );
        }
        yield* Effect.promise(() =>
          ctx.db.patch("tryoutAttemptPlacements", frozen._id, {
            placementRowHash: pair.next.rowHash,
            questionArtifactHash: pair.next.questionArtifactHash,
            answerArtifactHash: pair.next.answerArtifactHash,
          })
        );
        receipt.placements += 1;
      }
      for (const score of scores) {
        yield* Effect.promise(() =>
          ctx.db.patch("tryoutScores", score._id, {
            tryoutSnapshotId: state.newBundle.snapshotId,
          })
        );
        receipt.scores += 1;
      }
      yield* Effect.promise(() =>
        ctx.db.patch("tryoutAttempts", attempt._id, {
          tryoutBundleId: state.newBundle._id,
          tryoutBundleHash: state.newBundle.bundleHash,
          tryoutSnapshotId: state.newBundle.snapshotId,
        })
      );
      receipt.attempts += 1;
    }
    for (const { scale, items } of state.history.scaleEntries) {
      for (const item of items) {
        const pair = byIdentity.get(item.placementIdentity);
        if (!pair || item.placementRowHash !== pair.prior.rowHash) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            "Frozen IRT item no longer matches its original signed placement."
          );
        }
        yield* Effect.promise(() =>
          ctx.db.patch("irtScaleItems", item._id, {
            placementRowHash: pair.next.rowHash,
          })
        );
        receipt.scaleItems += 1;
      }
      yield* Effect.promise(() =>
        ctx.db.patch("irtScaleVersions", scale._id, {
          tryoutSnapshotId: state.newBundle.snapshotId,
        })
      );
      receipt.scales += 1;
    }
    return receipt;
  }
);
