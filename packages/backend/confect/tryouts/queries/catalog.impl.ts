import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/tryouts/queries/catalog.spec";
import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import { readFeaturedTryout } from "@repo/backend/content/tryout/featured";
import {
  readTryoutLocalizedPath,
  readTryoutMetadata,
} from "@repo/backend/content/tryout/metadata";
import {
  readTryoutCountryPage,
  readTryoutExamPage,
  readTryoutHubPage,
  readTryoutSectionPage,
  readTryoutSetPage,
  readTryoutTrackPage,
} from "@repo/backend/content/tryout/page";
import { Effect, Layer } from "effect";

const getFeaturedQuestion = FunctionImpl.make(
  databaseSchema,
  spec,
  "getFeaturedQuestion",
  Effect.fn("tryouts.queries.catalog.getFeaturedQuestion")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readFeaturedTryout(args.appLocale).pipe(
      Effect.provide(convexTryoutLayer(ctx))
    );
  })
);
const getMetadata = FunctionImpl.make(
  databaseSchema,
  spec,
  "getMetadata",
  Effect.fn("tryouts.queries.catalog.getMetadata")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readTryoutMetadata(args).pipe(
      Effect.provide(convexTryoutLayer(ctx))
    );
  })
);
const getLocalizedPath = FunctionImpl.make(
  databaseSchema,
  spec,
  "getLocalizedPath",
  Effect.fn("tryouts.queries.catalog.getLocalizedPath")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readTryoutLocalizedPath(args).pipe(
      Effect.provide(convexTryoutLayer(ctx))
    );
  })
);
const getHubPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "getHubPage",
  Effect.fn("tryouts.queries.catalog.getHubPage")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readTryoutHubPage(args).pipe(
      Effect.provide(convexTryoutLayer(ctx))
    );
  })
);
const getCountryPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCountryPage",
  Effect.fn("tryouts.queries.catalog.getCountryPage")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readTryoutCountryPage(args).pipe(
      Effect.provide(convexTryoutLayer(ctx))
    );
  })
);
const getExamPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "getExamPage",
  Effect.fn("tryouts.queries.catalog.getExamPage")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readTryoutExamPage(args).pipe(
      Effect.provide(convexTryoutLayer(ctx))
    );
  })
);
const getTrackPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "getTrackPage",
  Effect.fn("tryouts.queries.catalog.getTrackPage")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readTryoutTrackPage(args).pipe(
      Effect.provide(convexTryoutLayer(ctx))
    );
  })
);
const getSetPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "getSetPage",
  Effect.fn("tryouts.queries.catalog.getSetPage")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readTryoutSetPage(args).pipe(
      Effect.provide(convexTryoutLayer(ctx))
    );
  })
);
const getSectionPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "getSectionPage",
  Effect.fn("tryouts.queries.catalog.getSectionPage")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readTryoutSectionPage(args).pipe(
      Effect.provide(convexTryoutLayer(ctx))
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getFeaturedQuestion),
  Layer.provide(getMetadata),
  Layer.provide(getLocalizedPath),
  Layer.provide(getHubPage),
  Layer.provide(getCountryPage),
  Layer.provide(getExamPage),
  Layer.provide(getTrackPage),
  Layer.provide(getSetPage),
  Layer.provide(getSectionPage),
  GroupImpl.finalize
);
