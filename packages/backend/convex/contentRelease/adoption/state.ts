import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  hashHistory,
  readHistory,
} from "@repo/backend/convex/contentRelease/adoption/history";
import type {
  AdoptionIdentity,
  AdoptionState,
} from "@repo/backend/convex/contentRelease/adoption/spec";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadStaged } from "@repo/backend/convex/contentRelease/model";
import {
  decodeProofJson,
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import { loadSnapshot } from "@repo/backend/convex/contentRelease/snapshot/manifest";
import {
  findTryoutRuntimeBundleByHash,
  loadTryoutRuntimeBundle,
} from "@repo/backend/convex/tryouts/runtime/signed";
import { convexToJson } from "convex/values";
import { Effect, Schema } from "effect";

/** Pins the authenticated action to the exact transaction read set. */
export const hashAdoptionState = Effect.fn("contentRelease.adoption.hashState")(
  (state: AdoptionState) =>
    hashText("adoption state", JSON.stringify(convexToJson(state)))
);

/** Reads only a verified, unactivated current candidate and exact retained readers. */
export const readAdoptionState = Effect.fn("contentRelease.adoption.readState")(
  function* (ctx: QueryCtx | MutationCtx, input: AdoptionIdentity) {
    const { release, state } = yield* loadStaged(ctx, input.candidateReleaseId);
    if (
      release.role !== "candidate" ||
      release.status !== "verified" ||
      release.verifiedAt === undefined ||
      release.proofJson === undefined ||
      release.abortingAt !== undefined ||
      state.activeReleaseId === release.releaseId
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        "Adoption requires a verified, nonactive candidate."
      );
    }
    const signed = yield* decodeReleaseJson(release.releaseJson);
    const renderer = yield* decodeRendererJson(release.rendererJson);
    const proof = yield* decodeProofJson(release.proofJson);
    if (
      !(
        Schema.is(SignedContentReleaseSchema)(signed) &&
        Schema.is(RendererManifestEnvelopeSchema)(renderer)
      ) ||
      signed.manifestHash !== input.candidateManifestHash ||
      state.candidateManifestHash !== input.candidateManifestHash ||
      proof.manifestHash !== signed.manifestHash ||
      proof.releaseId !== release.releaseId ||
      proof.rendererManifestHash !== renderer.hash ||
      signed.manifest.rendererManifestHash !== renderer.hash ||
      signed.manifest.origin.kind !== "git"
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Adoption candidate is not the verified current signed source."
      );
    }
    const oldStored = yield* findTryoutRuntimeBundleByHash(
      ctx,
      input.oldBundleHash
    );
    const newStored = yield* findTryoutRuntimeBundleByHash(
      ctx,
      input.newBundleHash
    );
    if (
      !(oldStored && newStored) ||
      oldStored.snapshotId === newStored.snapshotId
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Adoption needs distinct retained and candidate snapshot bundles."
      );
    }
    const oldRuntime = yield* loadTryoutRuntimeBundle(
      ctx,
      oldStored.snapshotId,
      oldStored.rendererManifestHash
    );
    const newRuntime = yield* loadTryoutRuntimeBundle(
      ctx,
      newStored.snapshotId,
      newStored.rendererManifestHash
    );
    const oldSnapshot = yield* loadSnapshot(
      ctx,
      "tryout",
      oldStored.snapshotId
    );
    const newSnapshot = yield* loadSnapshot(
      ctx,
      "tryout",
      newStored.snapshotId
    );
    if (
      !(oldRuntime && newRuntime && oldSnapshot && newSnapshot) ||
      newSnapshot.verifiedAt === undefined ||
      oldRuntime.stored._id !== oldStored._id ||
      newRuntime.stored._id !== newStored._id ||
      newStored.sourceReleaseId !== release.releaseId ||
      newStored.sourceManifestHash !== signed.manifestHash ||
      newStored.rendererManifestHash !== renderer.hash ||
      newStored.sourceGitSha !== oldStored.sourceGitSha ||
      newStored.sourceGitSha !== signed.manifest.origin.sha ||
      release.tryoutRuntimeBundleHash !== newStored.bundleHash ||
      signed.manifest.snapshots.tryout.resultSnapshotId !== newStored.snapshotId
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Adoption bundle lost its verified historical source or snapshot."
      );
    }
    const history = yield* readHistory(ctx, oldStored.snapshotId);
    if (
      history.entries.some(
        ({ attempt }) =>
          attempt.tryoutBundleId !== oldStored._id ||
          attempt.tryoutBundleHash !== oldStored.bundleHash
      )
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        "Retained attempt bundle references changed."
      );
    }
    const identities = new Set([
      ...history.entries.flatMap((entry) =>
        entry.placements.map((placement) => placement.placementIdentity)
      ),
      ...history.scaleEntries.flatMap((entry) =>
        entry.items.map((item) => item.placementIdentity)
      ),
    ]);
    if (identities.size > 160) {
      return yield* releaseFail(
        "CONTENT_RELEASE_SIZE",
        "Historical placement inventory exceeds its reviewed bound."
      );
    }
    const placements: AdoptionState["placements"] = [];
    for (const identity of [...identities].sort()) {
      const prior = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutPlacements")
          .withIndex("by_snapshotId_and_identity", (q) =>
            q.eq("snapshotId", oldStored.snapshotId).eq("identity", identity)
          )
          .unique()
      );
      const next = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutPlacements")
          .withIndex("by_snapshotId_and_identity", (q) =>
            q.eq("snapshotId", newStored.snapshotId).eq("identity", identity)
          )
          .unique()
      );
      if (!(prior && next)) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Historical placement is absent from one signed snapshot."
        );
      }
      placements.push({ prior, next });
    }
    return {
      history,
      historyHash: yield* hashHistory(history),
      release,
      oldBundle: oldStored,
      newBundle: newStored,
      oldSnapshot,
      newSnapshot,
      placements,
    } satisfies AdoptionState;
  }
);
