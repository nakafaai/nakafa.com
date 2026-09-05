import {
  type ContentSnapshotManifest,
  contentSnapshotId,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot/scope";
import { loadActiveIdentity } from "@repo/backend/content/publication/read";
import { PublicationSource } from "@repo/backend/content/publication/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { decodeSnapshotJson } from "@repo/backend/convex/contentRelease/parse";
import { Effect, Option } from "effect";

/** Narrows a decoded snapshot through its actual family discriminant. */
function hasSnapshotFamily<Family extends ContentSnapshotKind>(
  snapshot: ContentSnapshotManifest,
  family: Family
): snapshot is Extract<ContentSnapshotManifest, { readonly family: Family }> {
  return snapshot.family === family;
}

/** Loads and authenticates one retained immutable family snapshot. */
export const loadVerifiedSnapshot = Effect.fn(
  "contentRelease.loadVerifiedSnapshot"
)(function* <const Family extends ContentSnapshotKind>(
  family: Family,
  snapshotId: string
) {
  const stored = Option.getOrNull(
    yield* (yield* PublicationSource).snapshot(family, snapshotId)
  );
  if (!stored || stored.verifiedAt === undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Verified ${family} snapshot ${snapshotId} is unavailable.`
    );
  }
  const decoded = yield* decodeSnapshotJson(stored.snapshotJson);
  const snapshot = decoded;
  if (
    !hasSnapshotFamily(snapshot, family) ||
    contentSnapshotId(snapshot) !== snapshotId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Verified ${family} snapshot lost its signed identity.`
    );
  }
  if (
    decoded.family === "quran" &&
    decoded.manifest.provenanceStatus !== "approved"
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
  function* <const Family extends ContentSnapshotKind>(family: Family) {
    const active = yield* loadActiveIdentity();
    if (!active) {
      return { active: null, snapshot: null, snapshotId: null };
    }
    const state = active.signed.manifest.snapshots[family];
    if (state.resultSnapshotId === null) {
      return { active, snapshot: null, snapshotId: null };
    }
    const { snapshot } = yield* loadVerifiedSnapshot(
      family,
      state.resultSnapshotId
    );
    return { active, snapshot, snapshotId: state.resultSnapshotId };
  }
);

/** Selects one verified immutable family snapshot from the active release. */
export const loadActiveSnapshot = Effect.fn(
  "contentRelease.loadActiveSnapshot"
)(function* <const Family extends ContentSnapshotKind>(family: Family) {
  const owner = yield* loadSnapshotOwner(family);
  if (
    owner.active === null ||
    owner.snapshot === null ||
    owner.snapshotId === null
  ) {
    return null;
  }
  return owner;
});
