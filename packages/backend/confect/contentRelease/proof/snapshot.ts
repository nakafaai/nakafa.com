"use node";

import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot/scope";
import { ContentSnapshotKindSchema } from "@nakafa/aksara-contracts/release/snapshot/scope";
import type { ContentSnapshotSet } from "@nakafa/aksara-contracts/release/snapshot/spec";
import {
  hasSameContentSnapshots,
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
  parseStoredJson,
} from "@repo/backend/confect/contentRelease/parse";
import { contractFailure } from "@repo/backend/confect/contentRelease/proof/failure";
import { Array as Arr, Effect, Option, Stream } from "effect";

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

/**
 * Batches the proof joins into one row page. A release stages snapshots in
 * batches of at most 16 rows, so reading them one per query cost the proof over
 * 1,400 sequential Convex round trips and ran it past the publisher's
 * ten-minute window.
 */
const PROOF_RUN_BATCHES = 64;
/** Row JSON one page may start another batch under: a few MiB per round trip. */
const PROOF_RUN_BYTES = 4 * 1024 * 1024;

/** Creates one replayable family row stream from exact release batch ledgers. */
function familyRows(releaseId: string, family: ContentSnapshotKind) {
  return Stream.paginate(-1, (afterBatchIndex) =>
    QueryRunner.pipe(
      Effect.flatMap(({ runQuery }) =>
        runQuery(contentReleaseInternal.snapshot.read.rows, {
          afterBatchIndex,
          family,
          maxBatches: PROOF_RUN_BATCHES,
          maxBytes: PROOF_RUN_BYTES,
          releaseId,
        })
      ),
      Effect.catchTag("SchemaError", Effect.die),
      Effect.map(
        (page): readonly [readonly string[], Option.Option<number>] => [
          page.rowJson,
          Option.filter(Option.some(page.nextBatchIndex), () => !page.done),
        ]
      )
    )
  ).pipe(Stream.mapEffect(parseStoredJson));
}

/**
 * Authenticates one replaced family against its own manifest and only its own rows. The contract replays its row
 * stream once to count and once per manifest, so a stream of every family decoded every row once per family plus
 * once: a release replacing all three decoded each row four times and outran an action's ten minutes.
 */
const verifyFamily = Effect.fn("contentRelease.verifyFamilySnapshot")(
  function* (
    release: SignedContentRelease,
    previous: ContentSnapshotSet | null,
    family: ContentSnapshotKind
  ) {
    const releaseId = release.manifest.releaseId;
    return yield* verifyContentSnapshots({
      manifests: Stream.fromEffect(readManifest(releaseId, family)),
      previousSnapshots: previous,
      rows: familyRows(releaseId, family),
    }).pipe(Effect.mapError(contractFailure));
  }
);

/**
 * Authenticates every replaced family, each on its own rows, and joins the proofs: a family takes the state its own
 * proof derived, and every family no proof replaced keeps the inherited state all proofs share.
 */
const verifyFamilies = Effect.fn("contentRelease.verifyFamilySnapshots")(
  function* (
    release: SignedContentRelease,
    previous: ContentSnapshotSet | null
  ) {
    const families = replacementFamilies(release);
    const proofs = yield* Effect.forEach(
      families,
      (family) => verifyFamily(release, previous, family),
      { concurrency: "unbounded" }
    );
    if (!Arr.isArrayNonEmpty(proofs)) {
      return yield* verifyContentSnapshots({
        manifests: Stream.empty,
        previousSnapshots: previous,
        rows: Stream.empty,
      }).pipe(Effect.mapError(contractFailure));
    }
    const proven = Arr.zip(families, proofs);
    const pick = (family: ContentSnapshotKind) =>
      Option.match(
        Arr.findFirst(proven, ([each]) => each === family),
        {
          onNone: () => proofs[0].snapshots[family],
          onSome: ([, proof]) => proof.snapshots[family],
        }
      );
    return {
      snapshots: {
        assessment: pick("assessment"),
        program: pick("program"),
        quran: pick("quran"),
      },
      stagedRows: Arr.reduce(proofs, 0, (sum, proof) => sum + proof.stagedRows),
    };
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

/** Authenticates candidate replacements or one zero-copy recovery inverse. */
export const verifyReleaseSnapshots = Effect.fn(
  "contentRelease.verifyReleaseSnapshots"
)(function* (
  release: SignedContentRelease,
  role: ReleaseRole,
  stagedSnapshotBatches: number,
  stagedSnapshotRows: number
) {
  const previous = yield* loadPrevious(release);
  const restoresPrevious =
    role === "recovery" || release.manifest.origin.kind === "rollback";
  if (restoresPrevious) {
    if (
      previous === null ||
      stagedSnapshotBatches !== 0 ||
      stagedSnapshotRows !== 0 ||
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
  const verified = yield* verifyFamilies(release, previous);
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
