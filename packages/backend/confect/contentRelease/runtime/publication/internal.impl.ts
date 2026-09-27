import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/contentRelease/runtime/publication/internal.spec";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import {
  resolvePublicRoute,
  resolvePublicRoutes,
} from "@repo/backend/content/publication/public";
import { Effect, Layer } from "effect";

/** Returns one public artifact only to the server-authenticated HTTP adapter. */
const read = FunctionImpl.make(
  databaseSchema,
  spec,
  "read",
  Effect.fn("contentRelease.runtime.publication.internal.read")(
    function* (args) {
      return yield* resolvePublicRoute(args.appLocale, args.publicPath).pipe(
        Effect.provide(publicationLayer)
      );
    }
  )
);
const readBatch = FunctionImpl.make(
  databaseSchema,
  spec,
  "readBatch",
  Effect.fn("contentRelease.runtime.publication.internal.readBatch")(
    function* (args) {
      return yield* resolvePublicRoutes(args.requests).pipe(
        Effect.provide(publicationLayer)
      );
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(read),
  Layer.provide(readBatch),
  GroupImpl.finalize
);
