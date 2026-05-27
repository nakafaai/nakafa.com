import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as content_sync_queries from "@repo/backend/confect/modules/content/contentSyncQueries.service";
import { Layer } from "effect";

const contentSync_queries_counts_countTablePageImpl = FunctionImpl.make(
  api,
  "contentSync.queries.counts",
  "countTablePage",
  (args) => content_sync_queries.countTablePage(args)
);

const contentSyncQueriesCountsImpl = GroupImpl.make(
  api,
  "contentSync.queries.counts"
).pipe(Layer.provide(contentSync_queries_counts_countTablePageImpl));

export { contentSyncQueriesCountsImpl };
