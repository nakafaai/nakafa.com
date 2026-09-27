import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import { stageBatch } from "@repo/backend/confect/contentRelease/snapshot/batch";
import spec from "@repo/backend/confect/contentRelease/snapshot/batch.spec";
import { Effect, Layer } from "effect";

/** Stores one decoded family row in its domain-owned physical table. */
const stageSnapshotBatch = FunctionImpl.make(
  databaseSchema,
  spec,
  "stageSnapshotBatch",
  Effect.fn("contentRelease.snapshot.batch.stageSnapshotBatch")(
    function* (args) {
      const ctx = yield* MutationCtxService;
      return yield* stageBatch(
        ctx,
        args.releaseId,
        args.family,
        args.snapshotId,
        args.batchIndex,
        args.rowJson
      );
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(stageSnapshotBatch),
  GroupImpl.finalize
);
