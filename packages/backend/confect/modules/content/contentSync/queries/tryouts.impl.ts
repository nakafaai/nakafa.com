import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as content_sync_queries from "@repo/backend/confect/modules/content/contentSyncQueries.service";
import { Layer } from "effect";

const contentSync_queries_tryouts_getTryoutScaleIntegrityImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.tryouts",
    "getTryoutScaleIntegrity",
    (args) => content_sync_queries.getTryoutScaleIntegrity(args)
  );

const contentSyncQueriesTryoutsImpl = GroupImpl.make(
  api,
  "contentSync.queries.tryouts"
).pipe(Layer.provide(contentSync_queries_tryouts_getTryoutScaleIntegrityImpl));

export { contentSyncQueriesTryoutsImpl };
