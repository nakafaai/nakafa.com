import { GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { Layer } from "effect";
import { contentSyncQueriesAuthorsImpl } from "./authors.impl";
import { contentSyncQueriesCountsImpl } from "./counts.impl";
import { contentSyncQueriesIntegrityImpl } from "./integrity.impl";
import { contentSyncQueriesStaleImpl } from "./stale.impl";
import { contentSyncQueriesTryoutsImpl } from "./tryouts.impl";

const contentSyncQueriesImpl = GroupImpl.make(api, "contentSync.queries")
  .pipe(Layer.provide(contentSyncQueriesAuthorsImpl))
  .pipe(Layer.provide(contentSyncQueriesCountsImpl))
  .pipe(Layer.provide(contentSyncQueriesIntegrityImpl))
  .pipe(Layer.provide(contentSyncQueriesStaleImpl))
  .pipe(Layer.provide(contentSyncQueriesTryoutsImpl));

export { contentSyncQueriesImpl };
