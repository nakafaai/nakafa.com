import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { readTryoutTaxonomy } from "@repo/backend/confect/contentRelease/tryout/taxonomy";
import spec from "@repo/backend/confect/contentRelease/tryout.spec";
import { readTryoutCatalog } from "@repo/backend/content/tryout/catalog";
import { tryoutLayer } from "@repo/backend/content/tryout/confect";
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
    return yield* readTryoutCatalog(appLocale).pipe(
      Effect.provide(tryoutLayer)
    );
  })
);
const sitemapCount = FunctionImpl.make(
  databaseSchema,
  spec,
  "sitemapCount",
  Effect.fn("contentRelease.tryout.sitemapCount")(function* ({ appLocale }) {
    return yield* readTryoutSitemapCount(appLocale).pipe(
      Effect.provide(tryoutLayer)
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
    return yield* readTryoutSitemapPage(appLocale, page).pipe(
      Effect.provide(tryoutLayer)
    );
  })
);
const taxonomy = FunctionImpl.make(
  databaseSchema,
  spec,
  "taxonomy",
  Effect.fn("contentRelease.tryout.taxonomy")(function* ({ appLocale }) {
    return yield* readTryoutTaxonomy(appLocale);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(catalog),
  Layer.provide(sitemapCount),
  Layer.provide(sitemapPage),
  Layer.provide(taxonomy),
  GroupImpl.finalize
);
