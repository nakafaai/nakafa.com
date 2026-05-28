import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { listStaleContentPage } from "@repo/backend/confect/modules/content/contentSyncQueries.service";
import { Effect, Layer } from "effect";

const contentSync_queries_stale_listStaleContentPageImpl = FunctionImpl.make(
  api,
  "contentSync.queries.stale",
  "listStaleContentPage",
  (args) => listStaleContentPage(args).pipe(Effect.orDie)
);

const contentSyncQueriesStaleImpl = GroupImpl.make(
  api,
  "contentSync.queries.stale"
).pipe(Layer.provide(contentSync_queries_stale_listStaleContentPageImpl));

export { contentSyncQueriesStaleImpl };
