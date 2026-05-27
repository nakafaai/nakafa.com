import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import type {
  GenerateAudioForQueueItemWorkflow,
  HandleAudioWorkflowComplete,
} from "@repo/backend/confect/modules/content/audioStudies.workflow-types";
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
        contentRef: Schema.Union(
          Schema.Struct({
            id: GenericId.GenericId("articleContents"),
            type: Schema.Literal("article"),
          }),
          Schema.Struct({
            id: GenericId.GenericId("subjectSections"),
            type: Schema.Literal("subject"),
          })
        ),
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
        contentRef: Schema.Union(
          Schema.Struct({
            id: GenericId.GenericId("articleContents"),
            type: Schema.Literal("article"),
          }),
          Schema.Struct({
            id: GenericId.GenericId("subjectSections"),
            type: Schema.Literal("subject"),
          })
        ),
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
          contentRef: Schema.Union(
            Schema.Struct({
              id: GenericId.GenericId("articleContents"),
              type: Schema.Literal("article"),
            }),
            Schema.Struct({
              id: GenericId.GenericId("subjectSections"),
              type: Schema.Literal("subject"),
            })
          ),
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
        contentRef: Schema.optional(
          Schema.Union(
            Schema.Struct({
              id: GenericId.GenericId("articleContents"),
              type: Schema.Literal("article"),
            }),
            Schema.Struct({
              id: GenericId.GenericId("subjectSections"),
              type: Schema.Literal("subject"),
            })
          )
        ),
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
            locale: Schema.String,
            title: Schema.String,
          }),
          contentAudio: Schema.Struct({
            contentHash: Schema.String,
            contentRef: Schema.Union(
              Schema.Struct({
                id: GenericId.GenericId("articleContents"),
                type: Schema.Literal("article"),
              }),
              Schema.Struct({
                id: GenericId.GenericId("subjectSections"),
                type: Schema.Literal("subject"),
              })
            ),
            status: Schema.Literal(
              "pending",
              "generating-script",
              "script-generated",
              "generating-speech",
              "completed",
              "failed"
            ),
            voiceId: Schema.String,
            voiceSettings: Schema.optional(
              Schema.Struct({
                similarityBoost: Schema.optional(Schema.Number),
                stability: Schema.optional(Schema.Number),
                style: Schema.optional(Schema.Number),
                useSpeakerBoost: Schema.optional(Schema.Boolean),
              })
            ),
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
          model: Schema.Literal("eleven_v3"),
          script: Schema.String,
          voiceId: Schema.String,
          voiceSettings: Schema.optional(
            Schema.Struct({
              similarityBoost: Schema.optional(Schema.Number),
              stability: Schema.optional(Schema.Number),
              style: Schema.optional(Schema.Number),
              useSpeakerBoost: Schema.optional(Schema.Boolean),
            })
          ),
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
        contentRef: Schema.Union(
          Schema.Struct({
            id: GenericId.GenericId("articleContents"),
            type: Schema.Literal("article"),
          }),
          Schema.Struct({
            id: GenericId.GenericId("subjectSections"),
            type: Schema.Literal("subject"),
          })
        ),
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
        status: Schema.Literal(
          "pending",
          "generating-script",
          "script-generated",
          "generating-speech",
          "completed",
          "failed"
        ),
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
