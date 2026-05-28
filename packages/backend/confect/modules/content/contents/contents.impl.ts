import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  processContentAnalyticsPartition,
  scheduleContentAnalyticsPartition,
  scheduleContentAnalyticsPartitions,
} from "@repo/backend/confect/modules/content/contentAnalytics.service";
import { search } from "@repo/backend/confect/modules/content/contentSearch/queries.service";
import { bulkSyncQuranSearch } from "@repo/backend/confect/modules/content/contentSearch/writes.service";
import {
  getRecentlyViewed,
  recordContentView,
} from "@repo/backend/confect/modules/content/contentViews.service";
import {
  enqueuePopularContentForAudio,
  getPopularContentForAudioQueue,
  populateAudioQueue,
} from "@repo/backend/confect/modules/content/popularAudioQueue.service";
import { Effect, Layer } from "effect";

const contents_mutations_views_recordContentViewImpl = FunctionImpl.make(
  api,
  "contents.mutations.views",
  "recordContentView",
  (args) => recordContentView(args).pipe(Effect.orDie)
);
const contents_mutations_audio_enqueuePopularContentForAudioImpl =
  FunctionImpl.make(
    api,
    "contents.mutations.audio",
    "enqueuePopularContentForAudio",
    (args) => enqueuePopularContentForAudio(args).pipe(Effect.orDie)
  );
const contents_queries_audio_getPopularContentForAudioQueueImpl =
  FunctionImpl.make(
    api,
    "contents.queries.audio",
    "getPopularContentForAudioQueue",
    (_args) => getPopularContentForAudioQueue().pipe(Effect.orDie)
  );
const contents_queries_recent_getRecentlyViewedImpl = FunctionImpl.make(
  api,
  "contents.queries.recent",
  "getRecentlyViewed",
  (args) => getRecentlyViewed(args).pipe(Effect.orDie)
);
const contents_actions_queue_populateAudioQueueImpl = FunctionImpl.make(
  api,
  "contents.actions.queue",
  "populateAudioQueue",
  (_args) => populateAudioQueue().pipe(Effect.orDie)
);
const contents_mutations_search_bulkSyncQuranSearchImpl = FunctionImpl.make(
  api,
  "contents.mutations.search",
  "bulkSyncQuranSearch",
  (args) => bulkSyncQuranSearch(args).pipe(Effect.orDie)
);
const contents_queries_search_searchImpl = FunctionImpl.make(
  api,
  "contents.queries.search",
  "search",
  (args) => search(args).pipe(Effect.orDie)
);
const contentsActionsQueueImpl = GroupImpl.make(
  api,
  "contents.actions.queue"
).pipe(Layer.provide(contents_actions_queue_populateAudioQueueImpl));
const contents_mutations_analytics_processContentAnalyticsPartitionImpl =
  FunctionImpl.make(
    api,
    "contents.mutations.analytics",
    "processContentAnalyticsPartition",
    (args) => processContentAnalyticsPartition(args).pipe(Effect.orDie)
  );
const contents_mutations_analytics_scheduleContentAnalyticsPartitionImpl =
  FunctionImpl.make(
    api,
    "contents.mutations.analytics",
    "scheduleContentAnalyticsPartition",
    (args) => scheduleContentAnalyticsPartition(args).pipe(Effect.orDie)
  );
const contents_mutations_analytics_scheduleContentAnalyticsPartitionsImpl =
  FunctionImpl.make(
    api,
    "contents.mutations.analytics",
    "scheduleContentAnalyticsPartitions",
    (_args) => scheduleContentAnalyticsPartitions().pipe(Effect.orDie)
  );
const contentsMutationsAnalyticsImpl = GroupImpl.make(
  api,
  "contents.mutations.analytics"
)
  .pipe(
    Layer.provide(
      contents_mutations_analytics_processContentAnalyticsPartitionImpl
    )
  )
  .pipe(
    Layer.provide(
      contents_mutations_analytics_scheduleContentAnalyticsPartitionImpl
    )
  )
  .pipe(
    Layer.provide(
      contents_mutations_analytics_scheduleContentAnalyticsPartitionsImpl
    )
  );
const contentsMutationsAudioImpl = GroupImpl.make(
  api,
  "contents.mutations.audio"
).pipe(
  Layer.provide(contents_mutations_audio_enqueuePopularContentForAudioImpl)
);
const contentsMutationsSearchImpl = GroupImpl.make(
  api,
  "contents.mutations.search"
).pipe(Layer.provide(contents_mutations_search_bulkSyncQuranSearchImpl));
const contentsMutationsViewsImpl = GroupImpl.make(
  api,
  "contents.mutations.views"
).pipe(Layer.provide(contents_mutations_views_recordContentViewImpl));
const contentsQueriesAudioImpl = GroupImpl.make(
  api,
  "contents.queries.audio"
).pipe(
  Layer.provide(contents_queries_audio_getPopularContentForAudioQueueImpl)
);
const contentsQueriesRecentImpl = GroupImpl.make(
  api,
  "contents.queries.recent"
).pipe(Layer.provide(contents_queries_recent_getRecentlyViewedImpl));
const contentsQueriesSearchImpl = GroupImpl.make(
  api,
  "contents.queries.search"
).pipe(Layer.provide(contents_queries_search_searchImpl));
const contentsActionsImpl = GroupImpl.make(api, "contents.actions").pipe(
  Layer.provide(contentsActionsQueueImpl)
);
const contentsMutationsImpl = GroupImpl.make(api, "contents.mutations")
  .pipe(Layer.provide(contentsMutationsAnalyticsImpl))
  .pipe(Layer.provide(contentsMutationsAudioImpl))
  .pipe(Layer.provide(contentsMutationsSearchImpl))
  .pipe(Layer.provide(contentsMutationsViewsImpl));
const contentsQueriesImpl = GroupImpl.make(api, "contents.queries")
  .pipe(Layer.provide(contentsQueriesAudioImpl))
  .pipe(Layer.provide(contentsQueriesRecentImpl))
  .pipe(Layer.provide(contentsQueriesSearchImpl));
const contentsImpl = GroupImpl.make(api, "contents")
  .pipe(Layer.provide(contentsActionsImpl))
  .pipe(Layer.provide(contentsMutationsImpl))
  .pipe(Layer.provide(contentsQueriesImpl));
export const contentsLayer = Layer.mergeAll(contentsImpl);
