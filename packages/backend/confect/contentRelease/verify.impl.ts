import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { verifyProgram } from "@repo/backend/confect/contentRelease/verify";
import spec from "@repo/backend/confect/contentRelease/verify.spec";
import { Effect, Layer } from "effect";

/** Freezes a complete staged release before any cross-transaction proof read. */
const verifyItems = FunctionImpl.make(
  databaseSchema,
  spec,
  "verifyItems",
  Effect.fn("contentRelease.verify.verifyItems")(function* (args) {
    return yield* verifyProgram(args.releaseId, args.afterIndex);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(verifyItems),
  GroupImpl.finalize
);
