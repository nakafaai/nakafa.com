import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/contentRelease/ownership.spec";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import { readRouteOwnership } from "@repo/backend/content/publication/route";
import { Effect, Layer } from "effect";

/** Returns active public-route ownership without exposing artifact code. */
const resolve = FunctionImpl.make(
  databaseSchema,
  spec,
  "resolve",
  Effect.fn("contentRelease.ownership.resolve")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readRouteOwnership(
      args.family,
      args.appLocale,
      args.publicPath
    ).pipe(Effect.provide(convexPublicationLayer(ctx)));
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(resolve),
  GroupImpl.finalize
);
