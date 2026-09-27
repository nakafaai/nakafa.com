import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/contentRelease/runtime/active.spec";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import { readActiveIdentity } from "@repo/backend/content/publication/read";
import { Effect, Layer } from "effect";

/** Returns the exact active release identity after full integrity validation. */
const read = FunctionImpl.make(
  databaseSchema,
  spec,
  "read",
  Effect.fn("contentRelease.runtime.active.read")(function* () {
    const ctx = yield* QueryCtxService;
    return yield* readActiveIdentity().pipe(
      Effect.provide(convexPublicationLayer(ctx))
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(read),
  GroupImpl.finalize
);
