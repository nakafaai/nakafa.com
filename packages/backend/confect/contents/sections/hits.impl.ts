import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { resolveHits } from "@repo/backend/confect/contents/sections/hits";
import spec from "@repo/backend/confect/contents/sections/hits.spec";
import { Effect, Layer } from "effect";

const resolve = FunctionImpl.make(
  databaseSchema,
  spec,
  "resolve",
  Effect.fn("contents.sections.hits.resolve")(function* (args) {
    return yield* resolveHits(args);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(resolve),
  GroupImpl.finalize
);
