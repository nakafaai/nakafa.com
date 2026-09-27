import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/contentRelease/reference.spec";
import { convexArticleLayer } from "@repo/backend/content/article/convex";
import { convexMaterialLayer } from "@repo/backend/content/material/convex";
import { convexQuranLayer } from "@repo/backend/content/quran/convex";
import { readContentReference } from "@repo/backend/content/reference/read";
import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import { Effect, Layer } from "effect";

/** Resolves one current public identity across active signed content families. */
const read = FunctionImpl.make(
  databaseSchema,
  spec,
  "read",
  Effect.fn("contentRelease.reference.read")(function* ({ input }) {
    const ctx = yield* QueryCtxService;
    return yield* readContentReference(input).pipe(
      Effect.provide(
        Layer.mergeAll(
          convexArticleLayer(ctx),
          convexMaterialLayer(ctx),
          convexQuranLayer(ctx),
          convexTryoutLayer(ctx)
        )
      )
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(read),
  GroupImpl.finalize
);
