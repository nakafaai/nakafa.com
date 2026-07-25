import {
  type ContentSnapshotManifest,
  contentSnapshotId,
} from "@nakafa/aksara-contracts/release/snapshot-data";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadStaged } from "@repo/backend/convex/contentRelease/model";
import {
  decodeReleaseJson,
  decodeSnapshotJson,
} from "@repo/backend/convex/contentRelease/parse";
import {
  ROLLBACK_RETENTION_MS,
  snapshotReceiptValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { encodeSnapshotJson } from "@repo/backend/convex/contentRelease/wire";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { WithoutSystemFields } from "convex/server";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;

/** Loads one immutable family manifest through its exact content identity. */
export const loadSnapshot = Effect.fn("contentRelease.loadSnapshot")(function* (
  ctx: ReadCtx,
  family: ContentSnapshotManifest["family"],
  snapshotId: string
) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("contentSnapshots")
      .withIndex("by_family_and_snapshotId", (query) =>
        query.eq("family", family).eq("snapshotId", snapshotId)
      )
      .unique()
  );
});

/** Proves a staged manifest is the signed replacement for its family. */
const requireReplacement = Effect.fn(
  "contentRelease.requireSnapshotReplacement"
)(function* (
  release: Doc<"contentReleases">,
  snapshot: ContentSnapshotManifest
) {
  const signed = yield* decodeReleaseJson(release.releaseJson);
  const state = signed.manifest.snapshots[snapshot.family];
  const snapshotId = contentSnapshotId(snapshot);
  if (state.mode !== "replace" || state.resultSnapshotId !== snapshotId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Snapshot ${snapshot.family}/${snapshotId} is not the signed replacement.`
    );
  }
  if (
    snapshot.family === "quran" &&
    snapshot.manifest.provenanceStatus !== "approved"
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_UNSUPPORTED",
      "Blocked Quran provenance cannot be staged for publication."
    );
  }
  return signed;
});

/** Stores or idempotently resumes one exact structured-family manifest. */
const stageManifest = Effect.fn("contentRelease.stageSnapshot")(function* (
  ctx: MutationCtx,
  releaseId: string,
  snapshotJson: string
) {
  const snapshot = yield* decodeSnapshotJson(snapshotJson);
  const canonicalJson = encodeSnapshotJson(snapshot);
  const snapshotId = contentSnapshotId(snapshot);
  const { release } = yield* loadStaged(ctx, releaseId);
  if (release.status !== "staging" || release.abortingAt !== undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${releaseId} no longer accepts snapshot manifests.`
    );
  }
  yield* requireReplacement(release, snapshot);
  const stored = yield* loadSnapshot(ctx, snapshot.family, snapshotId);
  if (stored) {
    if (stored.snapshotJson !== canonicalJson) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Snapshot ${snapshot.family}/${snapshotId} was reused with different bytes.`
      );
    }
    return {
      created: 0,
      family: snapshot.family,
      releaseId,
      snapshotId,
      unchanged: 1,
    } satisfies Infer<typeof snapshotReceiptValidator>;
  }
  const now = Date.now();
  const row = {
    createdAt: now,
    family: snapshot.family,
    retainUntil: now + ROLLBACK_RETENTION_MS,
    snapshotId,
    snapshotJson: canonicalJson,
  } satisfies WithoutSystemFields<Doc<"contentSnapshots">>;
  yield* ensureDocumentSize(
    `Content snapshot ${snapshot.family}/${snapshotId}`,
    row
  );
  yield* Effect.promise(() => ctx.db.insert("contentSnapshots", row));
  return {
    created: 1,
    family: snapshot.family,
    releaseId,
    snapshotId,
    unchanged: 0,
  } satisfies Infer<typeof snapshotReceiptValidator>;
});

/** Stages one immutable family manifest through internal publication state. */
export const stageSnapshot = internalMutation({
  args: { releaseId: v.string(), snapshotJson: v.string() },
  returns: snapshotReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(stageManifest(ctx, args.releaseId, args.snapshotJson)),
});
