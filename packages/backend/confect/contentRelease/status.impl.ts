import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
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
    const ctx = yield* QueryCtxService;
    return yield* statusProgram(ctx, args.manifestHash, args.releaseId);
  })
);
const current = FunctionImpl.make(
  databaseSchema,
  spec,
  "current",
  Effect.fn("contentRelease.status.current")(function* () {
    const ctx = yield* QueryCtxService;
    return yield* currentProgram(ctx);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getStatus),
  Layer.provide(current),
  GroupImpl.finalize
);
