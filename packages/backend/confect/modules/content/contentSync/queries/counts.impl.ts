import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { countTablePage } from "@repo/backend/confect/modules/content/contentSyncQueries.service";
import { Effect, Layer } from "effect";

const contentSync_queries_counts_countTablePageImpl = FunctionImpl.make(
  api,
  "contentSync.queries.counts",
  "countTablePage",
  (args) => countTablePage(args).pipe(Effect.orDie)
);
const contentSyncQueriesCountsImpl = GroupImpl.make(
  api,
  "contentSync.queries.counts"
).pipe(Layer.provide(contentSync_queries_counts_countTablePageImpl));

export { contentSyncQueriesCountsImpl };
