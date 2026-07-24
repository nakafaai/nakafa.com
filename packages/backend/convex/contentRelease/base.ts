import type { ContentReleaseManifest } from "@nakafa/aksara-contracts/release";
import {
  type ContentSnapshotKind,
  type ContentSnapshotState,
  hasSameContentSnapshots,
  invertContentSnapshots,
} from "@nakafa/aksara-contracts/release/snapshot";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadRelease } from "@repo/backend/convex/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { loadSnapshot } from "@repo/backend/convex/contentRelease/snapshot/manifest";
import { Effect } from "effect";

/** Checks every signed snapshot base against the active release results. */
function hasActiveSnapshotBase(
  manifest: ContentReleaseManifest,
  active: ContentReleaseManifest
) {
  return (
    manifest.snapshots.program.baseSnapshotId ===
      active.snapshots.program.resultSnapshotId &&
    manifest.snapshots.quran.baseSnapshotId ===
      active.snapshots.quran.resultSnapshotId &&
    manifest.snapshots.tryout.baseSnapshotId ===
      active.snapshots.tryout.resultSnapshotId
  );
}

/** Proves every zero-copy transition selects an existing verified snapshot. */
export const validateExistingSnapshots = Effect.fn(
  "contentRelease.validateExistingSnapshots"
)(function* (ctx: MutationCtx, manifest: ContentReleaseManifest) {
  const entries: readonly (readonly [
    ContentSnapshotKind,
    ContentSnapshotState,
  ])[] = [
    ["program", manifest.snapshots.program],
    ["quran", manifest.snapshots.quran],
    ["tryout", manifest.snapshots.tryout],
  ];
  for (const [family, snapshot] of entries) {
    if (snapshot.mode === "replace" || snapshot.resultSnapshotId === null) {
      continue;
    }
    const stored = yield* loadSnapshot(ctx, family, snapshot.resultSnapshotId);
    if (!stored || stored.verifiedAt === undefined) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Release ${manifest.releaseId} selects an unverified ${family} snapshot.`
      );
    }
  }
});

/** Proves a candidate manifest extends the exact completed active release. */
export const validateCandidateBase = Effect.fn(
  "contentRelease.validateCandidateBase"
)(function* (
  ctx: MutationCtx,
  manifest: ContentReleaseManifest,
  state: Doc<"contentState">
) {
  if (
    (state.activeReleaseId ?? null) !== manifest.baseReleaseId ||
    (state.activeManifestHash ?? null) !== manifest.baseManifestHash
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STALE_BASE",
      `Content release ${manifest.releaseId} does not extend the active release.`
    );
  }
  if (manifest.baseReleaseId === null) {
    if (
      Object.values(manifest.snapshots).some(
        ({ baseSnapshotId }) => baseSnapshotId !== null
      )
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STALE_BASE",
        `Content release ${manifest.releaseId} claims a structured genesis base.`
      );
    }
    return;
  }
  const base = yield* loadRelease(ctx, manifest.baseReleaseId);
  const signed = yield* decodeReleaseJson(base.releaseJson);
  if (
    base.status !== "completed" ||
    base.sequence !== state.activeSequence ||
    signed.manifestHash !== manifest.baseManifestHash ||
    signed.manifest.resultCount !== manifest.baseResultCount ||
    signed.manifest.resultDigest !== manifest.baseResultDigest ||
    !hasActiveSnapshotBase(manifest, signed.manifest)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STALE_BASE",
      `Content release ${manifest.releaseId} does not bind the active catalog.`
    );
  }
});

/** Proves an inverse manifest targets the exact verified candidate. */
export const validateRecoveryBase = Effect.fn(
  "contentRelease.validateRecoveryBase"
)(function* (
  ctx: MutationCtx,
  manifest: ContentReleaseManifest,
  rendererJson: string,
  state: Doc<"contentState">
) {
  if (!(state.candidateReleaseId && state.candidateManifestHash)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "A recovery release requires one verified candidate."
    );
  }
  const candidate = yield* loadRelease(ctx, state.candidateReleaseId);
  const signed = yield* decodeReleaseJson(candidate.releaseJson);
  if (
    candidate.role !== "candidate" ||
    candidate.status !== "verified" ||
    candidate.sequence !== state.candidateSequence ||
    rendererJson !== candidate.rendererJson ||
    manifest.origin.kind !== "rollback" ||
    manifest.origin.releaseId !== candidate.releaseId ||
    manifest.baseReleaseId !== candidate.releaseId ||
    manifest.baseManifestHash !== state.candidateManifestHash ||
    manifest.baseResultCount !== signed.manifest.resultCount ||
    manifest.baseResultDigest !== signed.manifest.resultDigest ||
    manifest.resultCount !== signed.manifest.baseResultCount ||
    manifest.resultDigest !== signed.manifest.baseResultDigest ||
    !hasSameContentSnapshots(
      manifest.snapshots,
      invertContentSnapshots(signed.manifest.snapshots)
    )
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Recovery ${manifest.releaseId} does not invert the verified candidate.`
    );
  }
});
