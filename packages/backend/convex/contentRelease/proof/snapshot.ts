"use node";

import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import {
  type ContentSnapshotKind,
  ContentSnapshotKindSchema,
  hasSameContentSnapshots,
  invertContentSnapshots,
} from "@nakafa/aksara-contracts/release/snapshot";
import { verifyContentSnapshots } from "@nakafa/aksara-contracts/release/snapshot-verify";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import {
  decodeReleaseJson,
  decodeSnapshotJson,
  parseStoredJson,
} from "@repo/backend/convex/contentRelease/parse";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import { makeFunctionReference } from "convex/server";
import { Effect, Option, Stream } from "effect";

interface StoredEnvelope {
  readonly releaseJson: string;
  readonly rendererJson: string;
}

interface SnapshotRowPage {
  readonly batchIndex: number;
  readonly done: boolean;
  readonly firstIndex: number;
  readonly nextBatchIndex: number;
  readonly rowJson: readonly string[];
  readonly snapshotId: string;
}

const envelopeReference = makeFunctionReference<
  "query",
  { releaseId: string },
  StoredEnvelope
>("contentRelease/envelope:byRelease");
const manifestReference = makeFunctionReference<
  "query",
  { family: ContentSnapshotKind; releaseId: string },
  string
>("contentRelease/snapshot/read:manifest");
const rowsReference = makeFunctionReference<
  "query",
  {
    afterBatchIndex: number;
    family: ContentSnapshotKind;
    releaseId: string;
  },
  SnapshotRowPage
>("contentRelease/snapshot/read:rows");

/** Returns fixed replacement families in canonical signed order. */
function replacementFamilies(release: SignedContentRelease) {
  return ContentSnapshotKindSchema.literals.filter(
    (family) => release.manifest.snapshots[family].mode === "replace"
  );
}

/** Loads and rechecks one manifest before the shared proof consumes it. */
const readManifest = Effect.fn("contentRelease.readProofSnapshotManifest")(
  function* (ctx: ActionCtx, releaseId: string, family: ContentSnapshotKind) {
    const source = yield* callInternal(() =>
      ctx.runQuery(manifestReference, { family, releaseId })
    );
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

/** Creates one replayable canonical replacement-manifest stream. */
function manifestStream(ctx: ActionCtx, release: SignedContentRelease) {
  return Stream.fromIterable(replacementFamilies(release)).pipe(
    Stream.mapEffect((family) =>
      readManifest(ctx, release.manifest.releaseId, family)
    )
  );
}

/** Creates one replayable family row stream from exact release batch ledgers. */
function familyRows(
  ctx: ActionCtx,
  releaseId: string,
  family: ContentSnapshotKind
) {
  return Stream.paginateEffect(-1, (afterBatchIndex) =>
    callInternal(() =>
      ctx.runQuery(rowsReference, { afterBatchIndex, family, releaseId })
    ).pipe(
      Effect.map((page): readonly [SnapshotRowPage, Option.Option<number>] => [
        page,
        page.done ? Option.none() : Option.some(page.nextBatchIndex),
      ])
    )
  ).pipe(
    Stream.flatMap(({ rowJson }) => Stream.fromIterable(rowJson)),
    Stream.mapEffect(parseStoredJson)
  );
}

/** Creates one replayable globally ordered structured-row stream. */
function rowStream(ctx: ActionCtx, release: SignedContentRelease) {
  return Stream.fromIterable(replacementFamilies(release)).pipe(
    Stream.flatMap((family) =>
      familyRows(ctx, release.manifest.releaseId, family)
    )
  );
}

/** Loads the exact signed base snapshot set or the empty genesis identity. */
const loadPrevious = Effect.fn("contentRelease.loadPreviousSnapshots")(
  function* (ctx: ActionCtx, release: SignedContentRelease) {
    const baseId = release.manifest.baseReleaseId;
    if (baseId === null) {
      return null;
    }
    const stored = yield* callInternal(() =>
      ctx.runQuery(envelopeReference, { releaseId: baseId })
    );
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
  ctx: ActionCtx,
  release: SignedContentRelease,
  role: "candidate" | "recovery",
  stagedSnapshotBatches: number,
  stagedSnapshotRows: number
) {
  const previous = yield* loadPrevious(ctx, release);
  if (role === "recovery") {
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
        `Recovery ${release.manifest.releaseId} does not exactly invert structured snapshots.`
      );
    }
    return { snapshots: release.manifest.snapshots, stagedRows: 0 };
  }
  const verified = yield* verifyContentSnapshots({
    manifests: () => manifestStream(ctx, release),
    previousSnapshots: previous,
    rows: () => rowStream(ctx, release),
  }).pipe(Effect.mapError(contractFailure));
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
