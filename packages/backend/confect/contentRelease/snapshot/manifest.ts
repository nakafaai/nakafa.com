import {
  type ContentSnapshotManifest,
  contentSnapshotId,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { ensureDocumentSize } from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadStaged } from "@repo/backend/confect/contentRelease/model";
import {
  decodeReleaseJson,
  decodeSnapshotJson,
} from "@repo/backend/confect/contentRelease/parse";
import {
  ROLLBACK_RETENTION_MS,
  type snapshotReceiptValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { encodeSnapshotJson } from "@repo/backend/confect/contentRelease/wire";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import type { WithoutSystemFields } from "convex/server";
import { Clock, Effect, type Schema } from "effect";
export type ReadCtx = MutationCtx | QueryCtx;

/** Loads one immutable family manifest through its exact content identity. */
export const loadSnapshot = Effect.fn("contentRelease.loadSnapshot")(function* (
  family: ContentSnapshotManifest["family"],
  snapshotId: string
) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("contentSnapshots")
    .get("by_family_and_snapshotId", family, snapshotId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/** Proves a staged manifest is the signed replacement for its family. */
export const requireReplacement = Effect.fn(
  "contentRelease.requireSnapshotReplacement"
)(function* (
  release: Docs["contentReleases"],
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
export const stageManifest = Effect.fn("contentRelease.stageSnapshot")(
  function* (releaseId: string, snapshotJson: string) {
    const writer = yield* DatabaseWriter;
    const snapshot = yield* decodeSnapshotJson(snapshotJson);
    const canonicalJson = encodeSnapshotJson(snapshot);
    const snapshotId = contentSnapshotId(snapshot);
    const { release } = yield* loadStaged(releaseId);
    if (release.status !== "staging" || release.abortingAt !== undefined) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Content release ${releaseId} no longer accepts snapshot manifests.`
      );
    }
    yield* requireReplacement(release, snapshot);
    const stored = yield* loadSnapshot(snapshot.family, snapshotId);
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
      } satisfies Schema.Schema.Type<typeof snapshotReceiptValidator>;
    }
    const now = yield* Clock.currentTimeMillis;
    const row = {
      createdAt: now,
      family: snapshot.family,
      retainUntil: now + ROLLBACK_RETENTION_MS,
      snapshotId,
      snapshotJson: canonicalJson,
    } satisfies WithoutSystemFields<Docs["contentSnapshots"]>;
    yield* ensureDocumentSize(
      `Content snapshot ${snapshot.family}/${snapshotId}`,
      row
    );
    yield* writer.table("contentSnapshots").insert(row).pipe(Effect.orDie);
    return {
      created: 1,
      family: snapshot.family,
      releaseId,
      snapshotId,
      unchanged: 0,
    } satisfies Schema.Schema.Type<typeof snapshotReceiptValidator>;
  }
);
