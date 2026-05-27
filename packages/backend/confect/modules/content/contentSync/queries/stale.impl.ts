import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as content_sync_queries from "@repo/backend/confect/modules/content/contentSyncQueries.service";
import { Layer } from "effect";

const contentSync_queries_stale_listStaleContentPageImpl = FunctionImpl.make(
  api,
  "contentSync.queries.stale",
  "listStaleContentPage",
  (args) => content_sync_queries.listStaleContentPage(args)
);

const contentSyncQueriesStaleImpl = GroupImpl.make(
  api,
  "contentSync.queries.stale"
).pipe(Layer.provide(contentSync_queries_stale_listStaleContentPageImpl));

export { contentSyncQueriesStaleImpl };
