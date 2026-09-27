import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { stageItemProgram } from "@repo/backend/confect/contentRelease/items";
import spec from "@repo/backend/confect/contentRelease/items.spec";
import { stageProjectionProgram } from "@repo/backend/confect/contentRelease/projection";
import { Effect, Layer } from "effect";

/** Decodes one bounded item batch through the shared wire contract. */
const stageItemBatch = FunctionImpl.make(
  databaseSchema,
  spec,
  "stageItemBatch",
  Effect.fn("contentRelease.items.stageItemBatch")(function* (args) {
    return yield* stageItemProgram(
      args.releaseId,
      args.batchIndex,
      args.itemJson
    );
  })
);
const stageProjectionBatch = FunctionImpl.make(
  databaseSchema,
  spec,
  "stageProjectionBatch",
  Effect.fn("contentRelease.items.stageProjectionBatch")(function* (args) {
    return yield* stageProjectionProgram(
      args.releaseId,
      args.batchIndex,
      args.projectionJson
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(stageItemBatch),
  Layer.provide(stageProjectionBatch),
  GroupImpl.finalize
);
