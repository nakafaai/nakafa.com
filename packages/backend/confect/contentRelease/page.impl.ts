import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/contentRelease/page.spec";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import { readPageCatalog } from "@repo/backend/content/publication/page";
import { Effect, Layer } from "effect";

const catalog = FunctionImpl.make(
  databaseSchema,
  spec,
  "catalog",
  Effect.fn("contentRelease.page.catalog")(function* () {
    const ctx = yield* QueryCtxService;
    return yield* readPageCatalog().pipe(
      Effect.provide(convexPublicationLayer(ctx))
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(catalog),
  GroupImpl.finalize
);
