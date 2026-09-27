import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  currentProgram,
  statusProgram,
} from "@repo/backend/confect/contentRelease/status";
import spec from "@repo/backend/confect/contentRelease/status.spec";
import { Effect, Layer } from "effect";

const getStatus = FunctionImpl.make(
  databaseSchema,
  spec,
  "getStatus",
  Effect.fn("contentRelease.status.getStatus")(function* (args) {
    return yield* statusProgram(args.manifestHash, args.releaseId);
  })
);
const current = FunctionImpl.make(
  databaseSchema,
  spec,
  "current",
  Effect.fn("contentRelease.status.current")(function* () {
    return yield* currentProgram();
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getStatus),
  Layer.provide(current),
  GroupImpl.finalize
);
