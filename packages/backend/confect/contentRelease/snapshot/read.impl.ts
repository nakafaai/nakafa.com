import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  batchCountProgram,
  manifestProgram,
  rowPageProgram,
} from "@repo/backend/confect/contentRelease/snapshot/read";
import spec from "@repo/backend/confect/contentRelease/snapshot/read.spec";
import { Effect, Layer } from "effect";

const manifest = FunctionImpl.make(
  databaseSchema,
  spec,
  "manifest",
  Effect.fn("contentRelease.snapshot.read.manifest")(function* (args) {
    return yield* manifestProgram(args.releaseId, args.family);
  })
);
const batchCount = FunctionImpl.make(
  databaseSchema,
  spec,
  "batchCount",
  Effect.fn("contentRelease.snapshot.read.batchCount")(function* (args) {
    return yield* batchCountProgram(args.releaseId, args.family);
  })
);
const rows = FunctionImpl.make(
  databaseSchema,
  spec,
  "rows",
  Effect.fn("contentRelease.snapshot.read.rows")(function* (args) {
    return yield* rowPageProgram(
      args.releaseId,
      args.family,
      args.afterBatchIndex,
      args.maxBatches,
      args.maxBytes
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(batchCount),
  Layer.provide(manifest),
  Layer.provide(rows),
  GroupImpl.finalize
);
