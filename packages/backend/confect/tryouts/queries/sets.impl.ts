import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import spec from "@repo/backend/confect/tryouts/queries/sets.spec";
import { listPublishedSets } from "@repo/backend/confect/tryouts/sets/published";
import { Effect, Layer } from "effect";

const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("tryouts.queries.sets.list")(function* (args) {
    return yield* listPublishedSets(args);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
