import { contentSnapshotId } from "@nakafa/aksara-contracts/release/snapshot/data";
import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot/scope";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { decodeSnapshotJson } from "@repo/backend/convex/contentRelease/parse";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import { loadSnapshot } from "@repo/backend/convex/contentRelease/snapshot/manifest";
import { Effect } from "effect";

/** Loads and authenticates one retained immutable family snapshot. */
export const loadVerifiedSnapshot = Effect.fn(
  "contentRelease.loadVerifiedSnapshot"
)(function* (ctx: QueryCtx, family: ContentSnapshotKind, snapshotId: string) {
  const stored = yield* loadSnapshot(ctx, family, snapshotId);
  if (!stored || stored.verifiedAt === undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Verified ${family} snapshot ${snapshotId} is unavailable.`
    );
  }
  const snapshot = yield* decodeSnapshotJson(stored.snapshotJson);
  if (
    snapshot.family !== family ||
    contentSnapshotId(snapshot) !== snapshotId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Verified ${family} snapshot lost its signed identity.`
    );
  }
  if (
    snapshot.family === "quran" &&
    snapshot.manifest.provenanceStatus !== "approved"
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_UNSUPPORTED",
      "Verified Quran snapshot has blocked provenance."
    );
  }
  return { snapshot, stored };
});

/** Resolves active release ownership and its optional verified family snapshot. */
export const loadSnapshotOwner = Effect.fn("contentRelease.loadSnapshotOwner")(
  function* (ctx: QueryCtx, family: ContentSnapshotKind) {
    const active = yield* loadActiveIdentity(ctx);
    if (!active) {
      return { active: null, snapshot: null, snapshotId: null };
    }
    const state = active.signed.manifest.snapshots[family];
    if (state.resultSnapshotId === null) {
      return { active, snapshot: null, snapshotId: null };
    }
    const { snapshot } = yield* loadVerifiedSnapshot(
      ctx,
      family,
      state.resultSnapshotId
    );
    return { active, snapshot, snapshotId: state.resultSnapshotId };
  }
);

/** Selects one verified immutable family snapshot from the active release. */
export const loadActiveSnapshot = Effect.fn(
  "contentRelease.loadActiveSnapshot"
)(function* (ctx: QueryCtx, family: ContentSnapshotKind) {
  const owner = yield* loadSnapshotOwner(ctx, family);
  if (
    owner.active === null ||
    owner.snapshot === null ||
    owner.snapshotId === null
  ) {
    return null;
  }
  return owner;
});
