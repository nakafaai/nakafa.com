import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import { stageManifest } from "@repo/backend/confect/contentRelease/snapshot/manifest";
import spec from "@repo/backend/confect/contentRelease/snapshot/manifest.spec";
import { Effect, Layer } from "effect";

const stageSnapshot = FunctionImpl.make(
  databaseSchema,
  spec,
  "stageSnapshot",
  Effect.fn("contentRelease.snapshot.manifest.stageSnapshot")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* stageManifest(ctx, args.releaseId, args.snapshotJson);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(stageSnapshot),
  GroupImpl.finalize
);
