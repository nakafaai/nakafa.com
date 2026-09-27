import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/contentRelease/program.spec";
import { readProgramCatalog } from "@repo/backend/content/program/catalog";
import { programLayer } from "@repo/backend/content/program/confect";
import { readProgramContext } from "@repo/backend/content/program/context";
import { readProgramPage } from "@repo/backend/content/program/page";
import { readProgramPath } from "@repo/backend/content/program/path";
import { readProgramRoute } from "@repo/backend/content/program/route";
import {
  readProgramBuckets,
  readProgramSitemap,
} from "@repo/backend/content/program/sitemap";
import { readProgramSubjects } from "@repo/backend/content/program/subjects";
import { Effect, Layer } from "effect";

const catalog = FunctionImpl.make(
  databaseSchema,
  spec,
  "catalog",
  Effect.fn("contentRelease.program.catalog")(function* ({ appLocale }) {
    return yield* readProgramCatalog(appLocale).pipe(
      Effect.provide(programLayer)
    );
  })
);
const subjects = FunctionImpl.make(
  databaseSchema,
  spec,
  "subjects",
  Effect.fn("contentRelease.program.subjects")(function* ({ appLocale }) {
    return yield* readProgramSubjects(appLocale).pipe(
      Effect.provide(programLayer)
    );
  })
);
const context = FunctionImpl.make(
  databaseSchema,
  spec,
  "context",
  Effect.fn("contentRelease.program.context")(function* (args) {
    return yield* readProgramContext(
      args.appLocale,
      {
        contentKey: args.contentKey,
        materialKey: args.materialKey,
        nodeKey: args.nodeKey,
        parentPath: args.parentPath,
        programKey: args.programKey,
        publicPath: args.publicPath,
      },
      args.expectedActiveReleaseId
    ).pipe(
      Effect.provide(programLayer),
      Effect.map(({ context: resolved, managed }) => ({
        groupJson: resolved?.groupJson ?? null,
        managed,
        mappingJson: resolved?.mappingJson ?? null,
        parentJson: resolved?.parentJson ?? null,
        resolvedCanonicalPath: resolved?.resolvedCanonicalPath ?? null,
      }))
    );
  })
);
const page = FunctionImpl.make(
  databaseSchema,
  spec,
  "page",
  Effect.fn("contentRelease.program.page")(function* (args) {
    return yield* readProgramPage(
      args.appLocale,
      args.expectedManifestHash,
      args.expectedReleaseId,
      args.paginationOpts
    ).pipe(Effect.provide(programLayer));
  })
);
const path = FunctionImpl.make(
  databaseSchema,
  spec,
  "path",
  Effect.fn("contentRelease.program.path")(function* ({
    appLocale,
    publicPath,
  }) {
    return yield* readProgramPath(appLocale, publicPath).pipe(
      Effect.provide(programLayer)
    );
  })
);
const route = FunctionImpl.make(
  databaseSchema,
  spec,
  "route",
  Effect.fn("contentRelease.program.route")(function* ({
    appLocale,
    publicPath,
  }) {
    return yield* readProgramRoute(appLocale, publicPath).pipe(
      Effect.provide(programLayer)
    );
  })
);
const sitemapBuckets = FunctionImpl.make(
  databaseSchema,
  spec,
  "sitemapBuckets",
  Effect.fn("contentRelease.program.sitemapBuckets")(function* ({ appLocale }) {
    return yield* readProgramBuckets(appLocale).pipe(
      Effect.provide(programLayer)
    );
  })
);
const sitemapPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "sitemapPage",
  Effect.fn("contentRelease.program.sitemapPage")(function* ({
    appLocale,
    bucket,
  }) {
    return yield* readProgramSitemap(appLocale, bucket).pipe(
      Effect.provide(programLayer)
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(catalog),
  Layer.provide(subjects),
  Layer.provide(context),
  Layer.provide(page),
  Layer.provide(path),
  Layer.provide(route),
  Layer.provide(sitemapBuckets),
  Layer.provide(sitemapPage),
  GroupImpl.finalize
);
