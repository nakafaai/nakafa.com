import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as content_analytics from "@repo/backend/confect/modules/content/contentAnalytics.service";
import * as content_search_queries from "@repo/backend/confect/modules/content/contentSearch/queries.service";
import * as content_search_writes from "@repo/backend/confect/modules/content/contentSearch/writes.service";
import * as content_views from "@repo/backend/confect/modules/content/contentViews.service";
import * as content_popular_audio from "@repo/backend/confect/modules/content/popularAudioQueue.service";
import { Layer } from "effect";

const contents_mutations_views_recordContentViewImpl = FunctionImpl.make(
  api,
  "contents.mutations.views",
  "recordContentView",
  (args) => content_views.recordContentView(args)
);

const contents_mutations_audio_enqueuePopularContentForAudioImpl =
  FunctionImpl.make(
    api,
    "contents.mutations.audio",
    "enqueuePopularContentForAudio",
    (args) => content_popular_audio.enqueuePopularContentForAudio(args)
  );

const contents_queries_audio_getPopularContentForAudioQueueImpl =
  FunctionImpl.make(
    api,
    "contents.queries.audio",
    "getPopularContentForAudioQueue",
    (_args) => content_popular_audio.getPopularContentForAudioQueue()
  );

const contents_queries_recent_getRecentlyViewedImpl = FunctionImpl.make(
  api,
  "contents.queries.recent",
  "getRecentlyViewed",
  (args) => content_views.getRecentlyViewed(args)
);

const contents_actions_queue_populateAudioQueueImpl = FunctionImpl.make(
  api,
  "contents.actions.queue",
  "populateAudioQueue",
  (_args) => content_popular_audio.populateAudioQueue()
);

const contents_mutations_search_bulkSyncQuranSearchImpl = FunctionImpl.make(
  api,
  "contents.mutations.search",
  "bulkSyncQuranSearch",
  (args) => content_search_writes.bulkSyncQuranSearch(args)
);

const contents_queries_search_searchImpl = FunctionImpl.make(
  api,
  "contents.queries.search",
  "search",
  (args) => content_search_queries.search(args)
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
    (args) => content_analytics.processContentAnalyticsPartition(args)
  );

const contents_mutations_analytics_scheduleContentAnalyticsPartitionImpl =
  FunctionImpl.make(
    api,
    "contents.mutations.analytics",
    "scheduleContentAnalyticsPartition",
    (args) => content_analytics.scheduleContentAnalyticsPartition(args)
  );

const contents_mutations_analytics_scheduleContentAnalyticsPartitionsImpl =
  FunctionImpl.make(
    api,
    "contents.mutations.analytics",
    "scheduleContentAnalyticsPartitions",
    (_args) => content_analytics.scheduleContentAnalyticsPartitions()
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
