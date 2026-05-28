import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { getTryoutScaleIntegrity as contentSyncQueries_getTryoutScaleIntegrity } from "@repo/backend/confect/modules/content/contentSyncQueries.service";
import { Effect, Layer } from "effect";

const contentSync_queries_tryouts_getTryoutScaleIntegrityImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.tryouts",
    "getTryoutScaleIntegrity",
    (args) =>
      contentSyncQueries_getTryoutScaleIntegrity(args).pipe(Effect.orDie)
  );

const contentSyncQueriesTryoutsImpl = GroupImpl.make(
  api,
  "contentSync.queries.tryouts"
).pipe(Layer.provide(contentSync_queries_tryouts_getTryoutScaleIntegrityImpl));

export { contentSyncQueriesTryoutsImpl };
