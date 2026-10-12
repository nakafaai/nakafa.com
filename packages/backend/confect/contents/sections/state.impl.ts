import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { isReady } from "@repo/backend/confect/contents/sections/state";
import spec from "@repo/backend/confect/contents/sections/state.spec";
import { embeddingModelId } from "@repo/backend/confect/gateway/model";
import { Effect, Layer } from "effect";

const ready = FunctionImpl.make(
  databaseSchema,
  spec,
  "ready",
  Effect.fn("contents.sections.state.ready")(function* () {
    return yield* isReady(embeddingModelId);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(ready),
  GroupImpl.finalize
);
