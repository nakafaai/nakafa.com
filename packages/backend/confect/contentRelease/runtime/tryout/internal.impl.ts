import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/contentRelease/runtime/tryout/internal.spec";
import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import { readProtectedProgram } from "@repo/backend/content/tryout/protected";
import { Effect, Layer } from "effect";

/** Returns one ordered protected batch from a permanent runtime bundle. */
const read = FunctionImpl.make(
  databaseSchema,
  spec,
  "read",
  Effect.fn("contentRelease.runtime.tryout.internal.read")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readProtectedProgram(args).pipe(
      Effect.provide(convexTryoutLayer(ctx))
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(read),
  GroupImpl.finalize
);
