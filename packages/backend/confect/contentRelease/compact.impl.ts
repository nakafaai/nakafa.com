import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  ActionCtx as ActionCtxService,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import {
  compactProgram,
  runProgram,
} from "@repo/backend/confect/contentRelease/compact";
import spec from "@repo/backend/confect/contentRelease/compact.spec";
import { Effect, Layer } from "effect";

const page = FunctionImpl.make(
  databaseSchema,
  spec,
  "page",
  Effect.fn("contentRelease.compact.page")(function* () {
    const ctx = yield* MutationCtxService;
    return yield* compactProgram(ctx);
  })
);
const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("contentRelease.compact.run")(function* () {
    const ctx = yield* ActionCtxService;
    return yield* runProgram(ctx);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(page),
  Layer.provide(run),
  GroupImpl.finalize
);
