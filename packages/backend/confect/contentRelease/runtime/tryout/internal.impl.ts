import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/contentRelease/runtime/tryout/internal.spec";
import { tryoutLayer } from "@repo/backend/content/tryout/confect";
import { readProtectedProgram } from "@repo/backend/content/tryout/protected";
import { Effect, Layer } from "effect";

/** Returns one ordered protected batch from a permanent runtime bundle. */
const read = FunctionImpl.make(
  databaseSchema,
  spec,
  "read",
  Effect.fn("contentRelease.runtime.tryout.internal.read")(function* (args) {
    return yield* readProtectedProgram(args).pipe(Effect.provide(tryoutLayer));
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(read),
  GroupImpl.finalize
);
