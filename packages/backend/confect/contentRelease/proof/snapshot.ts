"use node";

import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot/scope";
import { ContentSnapshotKindSchema } from "@nakafa/aksara-contracts/release/snapshot/scope";
import type { ContentSnapshotSet } from "@nakafa/aksara-contracts/release/snapshot/spec";
import {
  hasSameContentSnapshots,
  inheritContentSnapshots,
  invertContentSnapshots,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { verifyContentSnapshots } from "@nakafa/aksara-contracts/release/snapshot/verify";
import contentReleaseInternal from "@repo/backend/confect/_generated/refs/contentRelease.server";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import type { ReleaseRole } from "@repo/backend/confect/contentRelease/model";
import {
  decodeReleaseJson,
  decodeSnapshotJson,
} from "@repo/backend/confect/contentRelease/parse";
import { contractFailure } from "@repo/backend/confect/contentRelease/proof/failure";
import type { FamilySnapshotProof } from "@repo/backend/confect/contentRelease/proof/spec";
import { snapshotFamilyRows } from "@repo/backend/confect/contentRelease/proof/window";
import { Array as Arr, Effect, Stream } from "effect";

/** Returns fixed replacement families in canonical signed order. */
function replacementFamilies(release: SignedContentRelease) {
  return Arr.filter(
    ContentSnapshotKindSchema.literals,
    (family) => release.manifest.snapshots[family].mode === "replace"
  );
}

/** Loads and rechecks one manifest before the shared proof consumes it. */
const readManifest = Effect.fn("contentRelease.readProofSnapshotManifest")(
  function* (releaseId: string, family: ContentSnapshotKind) {
    const { runQuery } = yield* QueryRunner;
    const source = yield* runQuery(
      contentReleaseInternal.snapshot.read.manifest,
      {
        family,
        releaseId,
      }
    ).pipe(Effect.catchTag("SchemaError", Effect.die));
    const snapshot = yield* decodeSnapshotJson(source);
    if (
      snapshot.family === "quran" &&
      snapshot.manifest.provenanceStatus !== "approved"
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_UNSUPPORTED",
        "Blocked Quran provenance cannot pass publication proof."
      );
    }
    return snapshot;
  }
);

/** Loads the exact signed base snapshot set or the empty genesis identity. */
const loadPrevious = Effect.fn("contentRelease.loadPreviousSnapshots")(
  function* (release: SignedContentRelease) {
    const { runQuery } = yield* QueryRunner;
    const baseId = release.manifest.baseReleaseId;
    if (baseId === null) {
      return null;
    }
    const stored = yield* runQuery(contentReleaseInternal.envelope.byRelease, {
      releaseId: baseId,
    }).pipe(Effect.catchTag("SchemaError", Effect.die));
    const base = yield* decodeReleaseJson(stored.releaseJson);
    if (base.manifestHash !== release.manifest.baseManifestHash) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STALE_BASE",
        `Release ${release.manifest.releaseId} lost its exact snapshot base.`
      );
    }
    return base.manifest.snapshots;
  }
);

/** A rollback or recovery restores its base's snapshots without staging rows. */
function restoresPrevious(release: SignedContentRelease, role: ReleaseRole) {
  return role === "recovery" || release.manifest.origin.kind === "rollback";
}

/**
 * Authenticates one replaced family against its own manifest and only its own
 * rows, in its own durable step, so the largest family owns a whole action. The
 * contract replays its row stream once to count and once per manifest pass.
 * Returns null for a family the release keeps, and for every family of a
 * release that restores its base.
 */
export const proveSnapshotFamily = Effect.fn(
  "contentRelease.proveSnapshotFamily"
)(function* (
  release: SignedContentRelease,
  role: ReleaseRole,
  family: ContentSnapshotKind
) {
  if (
    restoresPrevious(release, role) ||
    release.manifest.snapshots[family].mode !== "replace"
  ) {
    return null;
  }
  const releaseId = release.manifest.releaseId;
  const previous = yield* loadPrevious(release);
  const proof = yield* verifyContentSnapshots({
    manifests: Stream.fromEffect(readManifest(releaseId, family)),
    previousSnapshots: previous,
    rows: snapshotFamilyRows(releaseId, family),
  }).pipe(Effect.mapError(contractFailure));
  return {
    family,
    stagedRows: proof.stagedRows,
    state: proof.snapshots[family],
  } satisfies FamilySnapshotProof;
});

/**
 * Joins the family proofs: each replaced family takes the state its own proof
 * derived, and every family the release keeps inherits its base result, as
 * the contract derives it. The proofs must name exactly the replaced families.
 */
const joinFamilies = Effect.fn("contentRelease.joinFamilySnapshots")(function* (
  release: SignedContentRelease,
  previous: ContentSnapshotSet | null,
  proofs: readonly FamilySnapshotProof[]
) {
  const families = replacementFamilies(release);
  const proven = Arr.map(proofs, (proof) => proof.family);
  if (
    families.length !== proven.length ||
    !Arr.every(families, (family, index) => proven[index] === family)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release ${release.manifest.releaseId} snapshot proofs do not cover its replaced families.`
    );
  }
  return {
    snapshots: Arr.reduce(
      proofs,
      inheritContentSnapshots(previous),
      (snapshots, proof): ContentSnapshotSet => ({
        ...snapshots,
        [proof.family]: proof.state,
      })
    ),
    stagedRows: Arr.reduce(proofs, 0, (sum, proof) => sum + proof.stagedRows),
  };
});

/** Authenticates candidate replacements or one zero-copy recovery inverse. */
export const verifyReleaseSnapshots = Effect.fn(
  "contentRelease.verifyReleaseSnapshots"
)(function* (
  release: SignedContentRelease,
  role: ReleaseRole,
  stagedSnapshotBatches: number,
  stagedSnapshotRows: number,
  proofs: readonly FamilySnapshotProof[]
) {
  const previous = yield* loadPrevious(release);
  if (restoresPrevious(release, role)) {
    if (
      previous === null ||
      stagedSnapshotBatches !== 0 ||
      stagedSnapshotRows !== 0 ||
      proofs.length !== 0 ||
      !hasSameContentSnapshots(
        release.manifest.snapshots,
        invertContentSnapshots(previous)
      )
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Release ${release.manifest.releaseId} does not exactly invert structured snapshots.`
      );
    }
    return {
      snapshots: release.manifest.snapshots,
      stagedRows: 0,
    };
  }
  const verified = yield* joinFamilies(release, previous, proofs);
  if (
    stagedSnapshotRows !== verified.stagedRows ||
    !hasSameContentSnapshots(verified.snapshots, release.manifest.snapshots)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release ${release.manifest.releaseId} snapshot proof does not match staged counters.`
    );
  }
  return verified;
});
