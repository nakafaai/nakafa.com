import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { markRetiredGeneration } from "@repo/backend/confect/contentRelease/migration";
import spec from "@repo/backend/confect/contentRelease/migration.spec";
import { Effect, Layer } from "effect";

const mark = FunctionImpl.make(
  databaseSchema,
  spec,
  "markRetiredGeneration",
  Effect.fn("contentRelease.migration.impl.markRetiredGeneration")(
    function* () {
      return yield* markRetiredGeneration();
    }
  )
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(mark),
  GroupImpl.finalize
);
