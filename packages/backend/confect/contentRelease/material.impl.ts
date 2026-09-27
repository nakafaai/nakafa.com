import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/contentRelease/material.spec";
import { readPartnerApiPage } from "@repo/backend/confect/contentRelease/partner/page";
import { convexMaterialLayer } from "@repo/backend/content/material/convex";
import {
  readLatestMaterials,
  readMaterialBucket,
} from "@repo/backend/content/material/discovery";
import { readMaterialIdentity } from "@repo/backend/content/material/identity";
import { readMaterialNavigation } from "@repo/backend/content/material/navigation";
import { readMaterialPage } from "@repo/backend/content/material/page";
import {
  readMaterialLesson,
  readMaterialModel,
} from "@repo/backend/content/material/read";
import {
  readMaterialBuckets,
  readMaterialSitemap,
} from "@repo/backend/content/material/sitemap";
import { Effect, Layer } from "effect";

const lesson = FunctionImpl.make(
  databaseSchema,
  spec,
  "lesson",
  Effect.fn("contentRelease.material.lesson")(function* ({
    appLocale,
    publicPath,
  }) {
    const ctx = yield* QueryCtxService;
    return yield* readMaterialLesson(appLocale, publicPath).pipe(
      Effect.provide(convexMaterialLayer(ctx))
    );
  })
);
const navigation = FunctionImpl.make(
  databaseSchema,
  spec,
  "navigation",
  Effect.fn("contentRelease.material.navigation")(function* ({
    appLocale,
    expectedActiveReleaseId,
    materialKey,
  }) {
    const ctx = yield* QueryCtxService;
    return yield* readMaterialNavigation(
      appLocale,
      materialKey,
      expectedActiveReleaseId
    ).pipe(Effect.provide(convexMaterialLayer(ctx)));
  })
);
const identity = FunctionImpl.make(
  databaseSchema,
  spec,
  "identity",
  Effect.fn("contentRelease.material.identity")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readMaterialIdentity(args).pipe(
      Effect.provide(convexMaterialLayer(ctx))
    );
  })
);
const apiPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "apiPage",
  Effect.fn("contentRelease.material.apiPage")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readPartnerApiPage(ctx, {
      ...args,
      family: "material",
    });
  })
);
const bucket = FunctionImpl.make(
  databaseSchema,
  spec,
  "bucket",
  Effect.fn("contentRelease.material.bucket")(function* ({
    appLocale,
    bucket: bucketId,
  }) {
    const ctx = yield* QueryCtxService;
    return yield* readMaterialBucket(appLocale, bucketId).pipe(
      Effect.provide(convexMaterialLayer(ctx))
    );
  })
);
const latest = FunctionImpl.make(
  databaseSchema,
  spec,
  "latest",
  Effect.fn("contentRelease.material.latest")(function* ({ appLocale, limit }) {
    const ctx = yield* QueryCtxService;
    return yield* readLatestMaterials(appLocale, limit).pipe(
      Effect.provide(convexMaterialLayer(ctx))
    );
  })
);
const publication = FunctionImpl.make(
  databaseSchema,
  spec,
  "publication",
  Effect.fn("contentRelease.material.publication")(function* ({
    appLocale,
    expectedActiveReleaseId,
    publicPath,
  }) {
    const ctx = yield* QueryCtxService;
    return yield* readMaterialModel(
      appLocale,
      publicPath,
      expectedActiveReleaseId
    ).pipe(Effect.provide(convexMaterialLayer(ctx)));
  })
);
const sitemapBuckets = FunctionImpl.make(
  databaseSchema,
  spec,
  "sitemapBuckets",
  Effect.fn("contentRelease.material.sitemapBuckets")(function* ({
    appLocale,
  }) {
    const ctx = yield* QueryCtxService;
    return yield* readMaterialBuckets(appLocale).pipe(
      Effect.provide(convexMaterialLayer(ctx))
    );
  })
);
const sitemapPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "sitemapPage",
  Effect.fn("contentRelease.material.sitemapPage")(function* ({
    appLocale,
    bucket: bucketId,
  }) {
    const ctx = yield* QueryCtxService;
    return yield* readMaterialSitemap(appLocale, bucketId).pipe(
      Effect.provide(convexMaterialLayer(ctx))
    );
  })
);
const publications = FunctionImpl.make(
  databaseSchema,
  spec,
  "publications",
  Effect.fn("contentRelease.material.publications")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readMaterialPage(
      args.appLocale,
      args.expectedManifestHash,
      args.expectedReleaseId,
      args.paginationOpts
    ).pipe(Effect.provide(convexMaterialLayer(ctx)));
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(lesson),
  Layer.provide(navigation),
  Layer.provide(identity),
  Layer.provide(apiPage),
  Layer.provide(bucket),
  Layer.provide(latest),
  Layer.provide(publication),
  Layer.provide(sitemapBuckets),
  Layer.provide(sitemapPage),
  Layer.provide(publications),
  GroupImpl.finalize
);
