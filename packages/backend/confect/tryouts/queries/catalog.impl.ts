import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/tryouts/queries/catalog.spec";
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
    return yield* readFeaturedTryout(args.appLocale);
  })
);
const getMetadata = FunctionImpl.make(
  databaseSchema,
  spec,
  "getMetadata",
  Effect.fn("tryouts.queries.catalog.getMetadata")(function* (args) {
    return yield* readTryoutMetadata(args);
  })
);
const getLocalizedPath = FunctionImpl.make(
  databaseSchema,
  spec,
  "getLocalizedPath",
  Effect.fn("tryouts.queries.catalog.getLocalizedPath")(function* (args) {
    return yield* readTryoutLocalizedPath(args);
  })
);
const getHubPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "getHubPage",
  Effect.fn("tryouts.queries.catalog.getHubPage")(function* (args) {
    return yield* readTryoutHubPage(args);
  })
);
const getCountryPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCountryPage",
  Effect.fn("tryouts.queries.catalog.getCountryPage")(function* (args) {
    return yield* readTryoutCountryPage(args);
  })
);
const getExamPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "getExamPage",
  Effect.fn("tryouts.queries.catalog.getExamPage")(function* (args) {
    return yield* readTryoutExamPage(args);
  })
);
const getTrackPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "getTrackPage",
  Effect.fn("tryouts.queries.catalog.getTrackPage")(function* (args) {
    return yield* readTryoutTrackPage(args);
  })
);
const getSetPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "getSetPage",
  Effect.fn("tryouts.queries.catalog.getSetPage")(function* (args) {
    return yield* readTryoutSetPage(args);
  })
);
const getSectionPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "getSectionPage",
  Effect.fn("tryouts.queries.catalog.getSectionPage")(function* (args) {
    return yield* readTryoutSectionPage(args);
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
