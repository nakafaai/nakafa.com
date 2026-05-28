import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  audioContentRefSchema,
  audioModelSchema,
  audioStatusSchema,
  voiceSettingsSchema,
} from "@repo/backend/confect/modules/content/audio.schemas";
import type {
  GenerateAudioForQueueItemWorkflow,
  HandleAudioWorkflowComplete,
} from "@repo/backend/confect/modules/content/audioStudies/workflows";
import { localeSchema } from "@repo/backend/confect/modules/content/content.schemas";
import { Schema } from "effect";

const audioStudiesWorkflowsGroup = GroupSpec.make("workflows")
  .addFunction(
    FunctionSpec.convexInternalMutation<GenerateAudioForQueueItemWorkflow>()(
      "generateAudioForQueueItem"
    )
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<HandleAudioWorkflowComplete>()(
      "handleWorkflowComplete"
    )
  );

export { audioStudiesWorkflowsGroup };

const audioStudiesMutationsContentAudiosGroup = GroupSpec.make("contentAudios")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "claimScriptGeneration",
      args: Schema.Struct({
        contentAudioId: GenericId.GenericId("contentAudios"),
      }),
      returns: Schema.Boolean,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "claimSpeechGeneration",
      args: Schema.Struct({
        contentAudioId: GenericId.GenericId("contentAudios"),
      }),
      returns: Schema.Boolean,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "createOrGetAudioRecord",
      args: Schema.Struct({
        contentHash: Schema.String,
        contentRef: audioContentRefSchema,
        locale: localeSchema,
      }),
      returns: GenericId.GenericId("contentAudios"),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "markFailed",
      args: Schema.Struct({
        contentAudioId: GenericId.GenericId("contentAudios"),
        error: Schema.String,
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "saveAudio",
      args: Schema.Struct({
        contentAudioId: GenericId.GenericId("contentAudios"),
        duration: Schema.Number,
        size: Schema.Number,
        storageId: GenericId.GenericId("_storage"),
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "saveScript",
      args: Schema.Struct({
        contentAudioId: GenericId.GenericId("contentAudios"),
        script: Schema.String,
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "updateContentHash",
      args: Schema.Struct({
        contentRef: audioContentRefSchema,
        newHash: Schema.String,
      }),
      returns: Schema.Struct({ updatedCount: Schema.Number }),
    })
  );

export { audioStudiesMutationsContentAudiosGroup };

const audioStudiesMutationsQueueGroup = GroupSpec.make("queue")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "cleanup",
      args: Schema.Struct({}),
      returns: Schema.Struct({ deleted: Schema.Number }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "lockQueueItem",
      args: Schema.Struct({
        queueItemId: GenericId.GenericId("audioGenerationQueue"),
      }),
      returns: Schema.Union(
        Schema.Null,
        Schema.Struct({
          contentRef: audioContentRefSchema,
          locale: localeSchema,
        })
      ),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "markQueueFailed",
      args: Schema.Struct({
        error: Schema.String,
        queueItemId: GenericId.GenericId("audioGenerationQueue"),
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "markQueueCompleted",
      args: Schema.Struct({
        queueItemId: GenericId.GenericId("audioGenerationQueue"),
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "resetStuckQueueItems",
      args: Schema.Struct({}),
      returns: Schema.Struct({ reset: Schema.Number }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "startWorkflowsForPendingItems",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        contentRef: Schema.optional(audioContentRefSchema),
        skipped: Schema.Number,
        started: Schema.Number,
      }),
    })
  );

export { audioStudiesMutationsQueueGroup };

const audioStudiesMutationsGroup = GroupSpec.make("mutations")
  .addGroup(audioStudiesMutationsContentAudiosGroup)
  .addGroup(audioStudiesMutationsQueueGroup);

export { audioStudiesMutationsGroup };

const audioStudiesQueriesInternalGroup = GroupSpec.make("internalFunctions")
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getAudioAndContentForScriptGeneration",
      args: Schema.Struct({
        contentAudioId: GenericId.GenericId("contentAudios"),
      }),
      returns: Schema.Union(
        Schema.Null,
        Schema.Struct({
          content: Schema.Struct({
            body: Schema.String,
            description: Schema.optional(Schema.String),
            locale: localeSchema,
            title: Schema.String,
          }),
          contentAudio: Schema.Struct({
            contentHash: Schema.String,
            contentRef: audioContentRefSchema,
            status: audioStatusSchema,
            voiceId: Schema.String,
            voiceSettings: Schema.optional(voiceSettingsSchema),
          }),
        })
      ),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getAudioForSpeechGeneration",
      args: Schema.Struct({
        contentAudioId: GenericId.GenericId("contentAudios"),
      }),
      returns: Schema.Union(
        Schema.Null,
        Schema.Struct({
          contentHash: Schema.String,
          model: audioModelSchema,
          script: Schema.String,
          voiceId: Schema.String,
          voiceSettings: Schema.optional(voiceSettingsSchema),
        })
      ),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "verifyContentHash",
      args: Schema.Struct({
        contentAudioId: GenericId.GenericId("contentAudios"),
        expectedHash: Schema.String,
      }),
      returns: Schema.Boolean,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getContentHash",
      args: Schema.Struct({
        contentRef: audioContentRefSchema,
      }),
      returns: Schema.Union(Schema.Null, Schema.String),
    })
  );

export { audioStudiesQueriesInternalGroup };

const audioStudiesQueriesPublicGroup = GroupSpec.make(
  "publicFunctions"
).addFunction(
  FunctionSpec.publicQuery({
    name: "getAudioBySlug",
    args: Schema.Struct({
      contentType: Schema.Literal("article", "subject"),
      locale: localeSchema,
      slug: Schema.String,
    }),
    returns: Schema.Union(
      Schema.Null,
      Schema.Struct({
        audioUrl: Schema.String,
        contentType: Schema.Literal("article", "subject"),
        duration: Schema.Number,
        script: Schema.optional(Schema.String),
        status: audioStatusSchema,
      })
    ),
  })
);

export { audioStudiesQueriesPublicGroup };

const audioStudiesQueriesGroup = GroupSpec.make("queries")
  .addGroup(audioStudiesQueriesInternalGroup)
  .addGroup(audioStudiesQueriesPublicGroup);

export { audioStudiesQueriesGroup };

const audioStudiesGroup = GroupSpec.make("audioStudies")
  .addGroup(audioStudiesWorkflowsGroup)
  .addGroup(audioStudiesMutationsGroup)
  .addGroup(audioStudiesQueriesGroup);

export { audioStudiesGroup };
