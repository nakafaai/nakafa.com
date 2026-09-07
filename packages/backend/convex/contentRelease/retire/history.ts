import { canonicalizeContentReleaseManifest } from "@nakafa/aksara-contracts/release/signing";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { protectedFloor } from "@repo/backend/convex/contentRelease/compact/state";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRelease,
  loadState,
} from "@repo/backend/convex/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import type {
  releaseIdentityValidator,
  retirementHistoryValidator,
} from "@repo/backend/convex/contentRelease/retire/spec";
import type { Infer } from "convex/values";
import { Effect } from "effect";

/** Proves the exact terminal release identity before its retirement is allowed. */
export const loadRetiredRelease = Effect.fn(
  "contentRelease.loadRetiredRelease"
)(function* (
  ctx: MutationCtx,
  identity: Infer<typeof releaseIdentityValidator>
) {
  const row = yield* loadRelease(ctx, identity.releaseId);
  const signed = yield* decodeReleaseJson(row.releaseJson);
  const manifestHash = yield* hashText(
    "the reviewed retirement manifest",
    canonicalizeContentReleaseManifest(signed.manifest)
  );
  if (
    row.sequence !== identity.sequence ||
    signed.manifestHash !== identity.manifestHash ||
    manifestHash !== identity.manifestHash ||
    signed.manifest.releaseId !== identity.releaseId ||
    (row.status !== "completed" && row.status !== "aborted") ||
    row.proofWorkflowId !== undefined
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release ${identity.releaseId} no longer matches the reviewed retirement identity.`
    );
  }
  return row;
});

/** Starts only the reviewed obsolete range in the native durable compactor. */
export const beginHistoryRetirement = Effect.fn(
  "contentRelease.beginHistoryRetirement"
)(function* (ctx: MutationCtx, plan: Infer<typeof retirementHistoryValidator>) {
  const first = plan.releases[0];
  const last = plan.releases.at(-1);
  if (
    !(first && last) ||
    plan.releases.length > 32 ||
    !Number.isSafeInteger(first.sequence) ||
    first.sequence < 1 ||
    plan.releases.some(
      (release, index) => release.sequence !== first.sequence + index
    )
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retirement requires one bounded contiguous release range."
    );
  }
  const floor = last.sequence + 1;
  const state = yield* loadState(ctx);
  if (
    !state ||
    state.activeReleaseId !== plan.active.releaseId ||
    state.activeManifestHash !== plan.active.manifestHash ||
    state.activeSequence !== plan.active.sequence ||
    state.candidateReleaseId !== undefined ||
    state.recoveryReleaseId !== undefined
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      "Publication slots changed after retirement review."
    );
  }
  if ((state.compactedFloor ?? 0) >= floor) {
    return { complete: true, floor };
  }
  if (state.compactPhase !== undefined) {
    if (state.compactFloor !== floor || state.compactFrom !== first.sequence) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        "Another history compaction already owns this deployment."
      );
    }
    return { complete: false, floor };
  }
  if ((state.compactedFloor ?? 0) !== first.sequence) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      "The reviewed range does not start at the compacted floor."
    );
  }
  const ceiling = yield* protectedFloor(ctx, state);
  if (floor > ceiling) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "The retirement range contains protected release history."
    );
  }
  const rows = yield* Effect.forEach(plan.releases, (identity) =>
    loadRetiredRelease(ctx, identity)
  );
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("contentReleases")
      .withIndex("by_sequence", (query) =>
        query.gte("sequence", first.sequence).lt("sequence", floor)
      )
      .take(plan.releases.length + 1)
  );
  if (
    stored.length !== rows.length ||
    stored.some((row, index) => row._id !== rows[index]?._id)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "The reviewed retirement range changed or contains duplicate sequences."
    );
  }
  const now = Date.now();
  yield* Effect.promise(() =>
    ctx.db.patch("contentState", state._id, {
      compactCursor: undefined,
      compactFloor: floor,
      compactFrom: first.sequence,
      compactPhase: "heads",
      compactStartedAt: now,
      updatedAt: now,
    })
  );
  return { complete: false, floor };
});
