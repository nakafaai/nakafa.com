import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/contentRelease/ownership.spec";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { readRouteOwnership } from "@repo/backend/content/publication/route";
import { Effect, Layer } from "effect";

/** Returns active public-route ownership without exposing artifact code. */
const resolve = FunctionImpl.make(
  databaseSchema,
  spec,
  "resolve",
  Effect.fn("contentRelease.ownership.resolve")(function* (args) {
    return yield* readRouteOwnership(
      args.family,
      args.appLocale,
      args.publicPath
    ).pipe(Effect.provide(publicationLayer));
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(resolve),
  GroupImpl.finalize
);
