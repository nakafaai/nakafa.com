import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import { readTryoutTaxonomy } from "@repo/backend/confect/contentRelease/tryout/taxonomy";
import spec from "@repo/backend/confect/contentRelease/tryout.spec";
import { readTryoutCatalog } from "@repo/backend/content/tryout/catalog";
import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import {
  readTryoutSitemapCount,
  readTryoutSitemapPage,
} from "@repo/backend/content/tryout/sitemap";
import { Effect, Layer } from "effect";

const catalog = FunctionImpl.make(
  databaseSchema,
  spec,
  "catalog",
  Effect.fn("contentRelease.tryout.catalog")(function* ({ appLocale }) {
    const ctx = yield* QueryCtxService;
    return yield* readTryoutCatalog(appLocale).pipe(
      Effect.provide(convexTryoutLayer(ctx))
    );
  })
);
const sitemapCount = FunctionImpl.make(
  databaseSchema,
  spec,
  "sitemapCount",
  Effect.fn("contentRelease.tryout.sitemapCount")(function* ({ appLocale }) {
    const ctx = yield* QueryCtxService;
    return yield* readTryoutSitemapCount(appLocale).pipe(
      Effect.provide(convexTryoutLayer(ctx))
    );
  })
);
const sitemapPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "sitemapPage",
  Effect.fn("contentRelease.tryout.sitemapPage")(function* ({
    appLocale,
    page,
  }) {
    const ctx = yield* QueryCtxService;
    return yield* readTryoutSitemapPage(appLocale, page).pipe(
      Effect.provide(convexTryoutLayer(ctx))
    );
  })
);
const taxonomy = FunctionImpl.make(
  databaseSchema,
  spec,
  "taxonomy",
  Effect.fn("contentRelease.tryout.taxonomy")(function* ({ appLocale }) {
    const ctx = yield* QueryCtxService;
    return yield* readTryoutTaxonomy(ctx, appLocale);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(catalog),
  Layer.provide(sitemapCount),
  Layer.provide(sitemapPage),
  Layer.provide(taxonomy),
  GroupImpl.finalize
);
