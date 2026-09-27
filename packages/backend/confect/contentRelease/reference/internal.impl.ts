import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { readAgentContentSource } from "@repo/backend/confect/contentRelease/reference/agent";
import spec from "@repo/backend/confect/contentRelease/reference/internal.spec";
import { Effect, Layer } from "effect";

const readAgentContent = FunctionImpl.make(
  databaseSchema,
  spec,
  "readAgentContent",
  Effect.fn("contentRelease.reference.internal.readAgentContent")(function* ({
    input,
  }) {
    return yield* readAgentContentSource(input);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(readAgentContent),
  GroupImpl.finalize
);
