import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { cleanupProgram } from "@repo/backend/confect/contentRelease/cleanup";
import spec from "@repo/backend/confect/contentRelease/cleanup.spec";
import { Effect, Layer } from "effect";

/** Validates server-owned cleanup counters before advancing a page. */
const cleanup = FunctionImpl.make(
  databaseSchema,
  spec,
  "cleanup",
  Effect.fn("contentRelease.cleanup.cleanup")(function* (args) {
    return yield* cleanupProgram(args.releaseId);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(cleanup),
  GroupImpl.finalize
);
