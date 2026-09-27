import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  rollbackProgram,
  routeProgram,
} from "@repo/backend/confect/contentRelease/rollback";
import spec from "@repo/backend/confect/contentRelease/rollback.spec";
import { Effect, Layer } from "effect";

/** Proves one release is an exact active or verified-candidate rollback source. */
const prepareRollback = FunctionImpl.make(
  databaseSchema,
  spec,
  "prepareRollback",
  Effect.fn("contentRelease.rollback.prepareRollback")(function* (args) {
    return yield* rollbackProgram(args);
  })
);
const prepareRoutes = FunctionImpl.make(
  databaseSchema,
  spec,
  "prepareRoutes",
  Effect.fn("contentRelease.rollback.prepareRoutes")(function* (args) {
    return yield* routeProgram(args);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(prepareRollback),
  Layer.provide(prepareRoutes),
  GroupImpl.finalize
);
