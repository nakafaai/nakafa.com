import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { countTablePage as contentSyncQueries_countTablePage } from "@repo/backend/confect/modules/content/contentSyncQueries.service";
import { Layer } from "effect";

const contentSync_queries_counts_countTablePageImpl = FunctionImpl.make(
  api,
  "contentSync.queries.counts",
  "countTablePage",
  (args) => contentSyncQueries_countTablePage(args)
);

const contentSyncQueriesCountsImpl = GroupImpl.make(
  api,
  "contentSync.queries.counts"
).pipe(Layer.provide(contentSync_queries_counts_countTablePageImpl));

export { contentSyncQueriesCountsImpl };
