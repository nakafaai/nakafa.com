import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadStaged } from "@repo/backend/confect/contentRelease/model";
import { stageBatch } from "@repo/backend/confect/contentRelease/snapshot/batch";
import spec from "@repo/backend/confect/contentRelease/snapshot/batch.spec";
import { loadSnapshot } from "@repo/backend/confect/contentRelease/snapshot/manifest";
import { Effect, Layer } from "effect";

/** Reads the stored manifests that bind one snapshot batch. */
const context = FunctionImpl.make(
  databaseSchema,
  spec,
  "context",
  Effect.fn("contentRelease.snapshot.batch.context")(function* (args) {
    const { release } = yield* loadStaged(args.releaseId);
    const snapshot = yield* loadSnapshot(args.family, args.snapshotId);
    if (!snapshot) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Snapshot ${args.family}/${args.snapshotId} must be staged before its rows.`
      );
    }
    return {
      releaseJson: release.releaseJson,
      snapshotJson: snapshot.snapshotJson,
    };
  })
);

/** Stores one prepared snapshot batch in its domain-owned tables. */
const stageSnapshotBatch = FunctionImpl.make(
  databaseSchema,
  spec,
  "stageSnapshotBatch",
  Effect.fn("contentRelease.snapshot.batch.stageSnapshotBatch")(
    function* (args) {
      return yield* stageBatch(args);
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(context),
  Layer.provide(stageSnapshotBatch),
  GroupImpl.finalize
);
