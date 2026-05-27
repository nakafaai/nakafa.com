import { GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { contentSyncQueriesAuthorsImpl } from "@repo/backend/confect/modules/content/contentSync/queries/authors.impl";
import { contentSyncQueriesCountsImpl } from "@repo/backend/confect/modules/content/contentSync/queries/counts.impl";
import { contentSyncQueriesIntegrityImpl } from "@repo/backend/confect/modules/content/contentSync/queries/integrity.impl";
import { contentSyncQueriesStaleImpl } from "@repo/backend/confect/modules/content/contentSync/queries/stale.impl";
import { contentSyncQueriesTryoutsImpl } from "@repo/backend/confect/modules/content/contentSync/queries/tryouts.impl";
import { Layer } from "effect";

const contentSyncQueriesImpl = GroupImpl.make(api, "contentSync.queries")
  .pipe(Layer.provide(contentSyncQueriesAuthorsImpl))
  .pipe(Layer.provide(contentSyncQueriesCountsImpl))
  .pipe(Layer.provide(contentSyncQueriesIntegrityImpl))
  .pipe(Layer.provide(contentSyncQueriesStaleImpl))
  .pipe(Layer.provide(contentSyncQueriesTryoutsImpl));

export { contentSyncQueriesImpl };
