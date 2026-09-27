import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { stageProgram } from "@repo/backend/confect/contentRelease/routes";
import spec from "@repo/backend/confect/contentRelease/routes.spec";
import { Effect, Layer } from "effect";

/** Decodes one bounded route batch through the shared wire contract. */
const stageRouteBatch = FunctionImpl.make(
  databaseSchema,
  spec,
  "stageRouteBatch",
  Effect.fn("contentRelease.routes.stageRouteBatch")(function* (args) {
    return yield* stageProgram(args.releaseId, args.batchIndex, args.routeJson);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(stageRouteBatch),
  GroupImpl.finalize
);
