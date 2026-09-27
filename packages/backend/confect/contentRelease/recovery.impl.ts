import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { lookupProgram } from "@repo/backend/confect/contentRelease/recovery";
import spec from "@repo/backend/confect/contentRelease/recovery.spec";
import { Effect, Layer } from "effect";

/** Exact stored recovery result returned to the authenticated Node verifier. */
const lookup = FunctionImpl.make(
  databaseSchema,
  spec,
  "lookup",
  Effect.fn("contentRelease.recovery.lookup")(function* (args) {
    return yield* lookupProgram(args.releaseId, args.recoveryId);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(lookup),
  GroupImpl.finalize
);
