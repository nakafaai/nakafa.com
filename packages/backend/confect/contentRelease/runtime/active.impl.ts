import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/contentRelease/runtime/active.spec";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { readActiveIdentity } from "@repo/backend/content/publication/read";
import { Effect, Layer } from "effect";

/** Returns the exact active release identity after full integrity validation. */
const read = FunctionImpl.make(
  databaseSchema,
  spec,
  "read",
  Effect.fn("contentRelease.runtime.active.read")(function* () {
    return yield* readActiveIdentity().pipe(Effect.provide(publicationLayer));
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(read),
  GroupImpl.finalize
);
