import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { audioContentRefSchema } from "@repo/backend/confect/modules/content/audio.schemas";
import {
  contentViewRefSchema,
  gradeSchema,
  localeSchema,
  materialSchema,
} from "@repo/backend/confect/modules/content/content.schemas";
import {
  contentSearchInputSchema,
  contentSearchResultSchema,
} from "@repo/backend/confect/modules/content/search.schemas";
import { Schema } from "effect";

const contentsMutationsAnalyticsGroup = GroupSpec.make("analytics")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "processContentAnalyticsPartition",
      args: Schema.Struct({
        leaseVersion: Schema.Number,
        partition: Schema.Number,
      }),
      returns: Schema.Struct({
        hasMore: Schema.Boolean,
        partition: Schema.Number,
        processed: Schema.Number,
        skipped: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "scheduleContentAnalyticsPartition",
      args: Schema.Struct({ partition: Schema.Number }),
      returns: Schema.Struct({
        createdPartition: Schema.Boolean,
        scheduled: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "scheduleContentAnalyticsPartitions",
      args: Schema.Struct({}),
      returns: Schema.Struct({ enqueuedPartitions: Schema.Number }),
    })
  );

export { contentsMutationsAnalyticsGroup };

const contentsMutationsViewsGroup = GroupSpec.make("views").addFunction(
  FunctionSpec.publicMutation({
    name: "recordContentView",
    args: Schema.Struct({
      contentRef: contentViewRefSchema,
      deviceId: Schema.String,
      locale: localeSchema,
    }),
    returns: Schema.Struct({
      alreadyViewed: Schema.Boolean,
      isNewView: Schema.Boolean,
      success: Schema.Boolean,
    }),
  })
);

export { contentsMutationsViewsGroup };

const contentsMutationsAudioGroup = GroupSpec.make("audio").addFunction(
  FunctionSpec.internalMutation({
    name: "enqueuePopularContentForAudio",
    args: Schema.Struct({
      items: Schema.Array(
        Schema.Struct({
          ref: audioContentRefSchema,
          sourceContent: Schema.optional(
            Schema.Struct({
              contentHash: Schema.String,
              locale: localeSchema,
              ref: audioContentRefSchema,
              slug: Schema.String,
            })
          ),
          viewCount: Schema.Number,
        })
      ),
    }),
    returns: Schema.Struct({ processed: Schema.Number, queued: Schema.Number }),
  })
);

export { contentsMutationsAudioGroup };

const contentsMutationsSearchGroup = GroupSpec.make("search").addFunction(
  FunctionSpec.internalMutation({
    name: "bulkSyncQuranSearch",
    args: Schema.Struct({
      documents: Schema.Array(
        Schema.Struct({
          contentHash: Schema.String,
          description: Schema.String,
          locale: localeSchema,
          route: Schema.String,
          text: Schema.String,
          title: Schema.String,
        })
      ),
    }),
    returns: Schema.Struct({
      created: Schema.Number,
      unchanged: Schema.Number,
      updated: Schema.Number,
    }),
  })
);

export { contentsMutationsSearchGroup };

const contentsMutationsGroup = GroupSpec.make("mutations")
  .addGroup(contentsMutationsAnalyticsGroup)
  .addGroup(contentsMutationsViewsGroup)
  .addGroup(contentsMutationsAudioGroup)
  .addGroup(contentsMutationsSearchGroup);

export { contentsMutationsGroup };

const contentsQueriesAudioGroup = GroupSpec.make("audio").addFunction(
  FunctionSpec.internalQuery({
    name: "getPopularContentForAudioQueue",
    args: Schema.Struct({}),
    returns: Schema.Array(
      Schema.Struct({
        ref: audioContentRefSchema,
        sourceContent: Schema.optional(
          Schema.Struct({
            contentHash: Schema.String,
            locale: localeSchema,
            ref: audioContentRefSchema,
            slug: Schema.String,
          })
        ),
        viewCount: Schema.Number,
      })
    ),
  })
);

export { contentsQueriesAudioGroup };

const contentsQueriesRecentGroup = GroupSpec.make("recent").addFunction(
  FunctionSpec.publicQuery({
    name: "getRecentlyViewed",
    args: Schema.Struct({
      limit: Schema.optional(Schema.Number),
      locale: localeSchema,
    }),
    returns: Schema.Array(
      Schema.Struct({
        description: Schema.optional(Schema.String),
        grade: gradeSchema,
        id: GenericId.GenericId("subjectSections"),
        lastViewedAt: Schema.Number,
        material: materialSchema,
        slug: Schema.String,
        title: Schema.String,
      })
    ),
  })
);

export { contentsQueriesRecentGroup };

const contentsQueriesSearchGroup = GroupSpec.make("search").addFunction(
  FunctionSpec.publicQuery({
    name: "search",
    args: contentSearchInputSchema,
    returns: contentSearchResultSchema,
  })
);

export { contentsQueriesSearchGroup };

const contentsQueriesGroup = GroupSpec.make("queries")
  .addGroup(contentsQueriesAudioGroup)
  .addGroup(contentsQueriesRecentGroup)
  .addGroup(contentsQueriesSearchGroup);

export { contentsQueriesGroup };

const contentsActionsQueueGroup = GroupSpec.make("queue").addFunction(
  FunctionSpec.internalAction({
    name: "populateAudioQueue",
    args: Schema.Struct({}),
    returns: Schema.Null,
  })
);

export { contentsActionsQueueGroup };

const contentsActionsGroup = GroupSpec.make("actions").addGroup(
  contentsActionsQueueGroup
);

export { contentsActionsGroup };

const contentsGroup = GroupSpec.make("contents")
  .addGroup(contentsMutationsGroup)
  .addGroup(contentsQueriesGroup)
  .addGroup(contentsActionsGroup);

export { contentsGroup };
