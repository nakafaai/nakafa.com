import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/contentRelease/runtime/publication/internal.spec";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
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
      const ctx = yield* QueryCtxService;
      return yield* resolvePublicRoute(args.appLocale, args.publicPath).pipe(
        Effect.provide(convexPublicationLayer(ctx))
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
      const ctx = yield* QueryCtxService;
      return yield* resolvePublicRoutes(args.requests).pipe(
        Effect.provide(convexPublicationLayer(ctx))
      );
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(read),
  Layer.provide(readBatch),
  GroupImpl.finalize
);
