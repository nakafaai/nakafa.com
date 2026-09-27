import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import { acceptProgram } from "@repo/backend/confect/contentRelease/accept";
import spec from "@repo/backend/confect/contentRelease/accept.spec";
import { Effect, Layer } from "effect";

/** Builds the cumulative terminal receipt retained by an aborted recovery. */
const accept = FunctionImpl.make(
  databaseSchema,
  spec,
  "accept",
  Effect.fn("contentRelease.accept.accept")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* acceptProgram(ctx, args.releaseId, args.recoveryId);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(accept),
  GroupImpl.finalize
);
