import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  getAudioBySlug as contentAudioLookup_getAudioBySlug,
  getContentHash as contentAudioLookup_getContentHash,
} from "@repo/backend/confect/modules/content/audioContentLookup.service";
import {
  claimScriptGeneration as contentAudioRecords_claimScriptGeneration,
  claimSpeechGeneration as contentAudioRecords_claimSpeechGeneration,
  createOrGetAudioRecord as contentAudioRecords_createOrGetAudioRecord,
  getAudioAndContentForScriptGeneration as contentAudioRecords_getAudioAndContentForScriptGeneration,
  getAudioForSpeechGeneration as contentAudioRecords_getAudioForSpeechGeneration,
  markFailed as contentAudioRecords_markFailed,
  saveAudio as contentAudioRecords_saveAudio,
  saveScript as contentAudioRecords_saveScript,
  updateContentHash as contentAudioRecords_updateContentHash,
  verifyContentHash as contentAudioRecords_verifyContentHash,
} from "@repo/backend/confect/modules/content/audioContentRecords.service";
import {
  cleanup as contentAudioQueue_cleanup,
  lockQueueItem as contentAudioQueue_lockQueueItem,
  markQueueCompleted as contentAudioQueue_markQueueCompleted,
  markQueueFailed as contentAudioQueue_markQueueFailed,
  resetStuckQueueItems as contentAudioQueue_resetStuckQueueItems,
  startWorkflowsForPendingItems as contentAudioQueue_startWorkflowsForPendingItems,
} from "@repo/backend/confect/modules/content/audioQueue.service";
import {
  generateAudioForQueueItem,
  handleWorkflowComplete,
} from "@repo/backend/confect/modules/content/audioStudies/workflows";
import { Effect, Layer } from "effect";

const audioStudies_mutations_contentAudios_claimScriptGenerationImpl =
  FunctionImpl.make(
    api,
    "audioStudies.mutations.contentAudios",
    "claimScriptGeneration",
    (args) => contentAudioRecords_claimScriptGeneration(args).pipe(Effect.orDie)
  );

const audioStudies_mutations_contentAudios_claimSpeechGenerationImpl =
  FunctionImpl.make(
    api,
    "audioStudies.mutations.contentAudios",
    "claimSpeechGeneration",
    (args) => contentAudioRecords_claimSpeechGeneration(args).pipe(Effect.orDie)
  );

const audioStudies_mutations_contentAudios_createOrGetAudioRecordImpl =
  FunctionImpl.make(
    api,
    "audioStudies.mutations.contentAudios",
    "createOrGetAudioRecord",
    (args) =>
      contentAudioRecords_createOrGetAudioRecord(args).pipe(Effect.orDie)
  );

const audioStudies_workflows_generateAudioForQueueItemImpl = FunctionImpl.make(
  api,
  "audioStudies.workflows",
  "generateAudioForQueueItem",
  generateAudioForQueueItem
);

const audioStudies_workflows_handleWorkflowCompleteImpl = FunctionImpl.make(
  api,
  "audioStudies.workflows",
  "handleWorkflowComplete",
  handleWorkflowComplete
);

const audioStudies_mutations_contentAudios_markFailedImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.contentAudios",
  "markFailed",
  (args) => contentAudioRecords_markFailed(args).pipe(Effect.orDie)
);

const audioStudies_mutations_contentAudios_saveAudioImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.contentAudios",
  "saveAudio",
  (args) => contentAudioRecords_saveAudio(args).pipe(Effect.orDie)
);

const audioStudies_mutations_contentAudios_saveScriptImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.contentAudios",
  "saveScript",
  (args) => contentAudioRecords_saveScript(args).pipe(Effect.orDie)
);

const audioStudies_mutations_contentAudios_updateContentHashImpl =
  FunctionImpl.make(
    api,
    "audioStudies.mutations.contentAudios",
    "updateContentHash",
    (args) => contentAudioRecords_updateContentHash(args).pipe(Effect.orDie)
  );

const audioStudies_mutations_queue_cleanupImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.queue",
  "cleanup",
  (_args) => contentAudioQueue_cleanup().pipe(Effect.orDie)
);

const audioStudies_mutations_queue_lockQueueItemImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.queue",
  "lockQueueItem",
  (args) => contentAudioQueue_lockQueueItem(args).pipe(Effect.orDie)
);

const audioStudies_mutations_queue_markQueueFailedImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.queue",
  "markQueueFailed",
  (args) => contentAudioQueue_markQueueFailed(args).pipe(Effect.orDie)
);

const audioStudies_mutations_queue_markQueueCompletedImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.queue",
  "markQueueCompleted",
  (args) =>
    contentAudioQueue_markQueueCompleted(args.queueItemId).pipe(Effect.orDie)
);

const audioStudies_mutations_queue_resetStuckQueueItemsImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.queue",
  "resetStuckQueueItems",
  (_args) => contentAudioQueue_resetStuckQueueItems().pipe(Effect.orDie)
);

const audioStudies_mutations_queue_startWorkflowsForPendingItemsImpl =
  FunctionImpl.make(
    api,
    "audioStudies.mutations.queue",
    "startWorkflowsForPendingItems",
    (_args) =>
      contentAudioQueue_startWorkflowsForPendingItems().pipe(Effect.orDie)
  );

const audioStudies_queries_internal_getAudioAndContentForScriptGenerationImpl =
  FunctionImpl.make(
    api,
    "audioStudies.queries.internalFunctions",
    "getAudioAndContentForScriptGeneration",
    (args) =>
      contentAudioRecords_getAudioAndContentForScriptGeneration(args).pipe(
        Effect.orDie
      )
  );

const audioStudies_queries_internal_getAudioForSpeechGenerationImpl =
  FunctionImpl.make(
    api,
    "audioStudies.queries.internalFunctions",
    "getAudioForSpeechGeneration",
    (args) =>
      contentAudioRecords_getAudioForSpeechGeneration(args).pipe(Effect.orDie)
  );

const audioStudies_queries_internal_verifyContentHashImpl = FunctionImpl.make(
  api,
  "audioStudies.queries.internalFunctions",
  "verifyContentHash",
  (args) => contentAudioRecords_verifyContentHash(args).pipe(Effect.orDie)
);

const audioStudies_queries_internal_getContentHashImpl = FunctionImpl.make(
  api,
  "audioStudies.queries.internalFunctions",
  "getContentHash",
  (args) => contentAudioLookup_getContentHash(args).pipe(Effect.orDie)
);

const audioStudies_queries_public_getAudioBySlugImpl = FunctionImpl.make(
  api,
  "audioStudies.queries.publicFunctions",
  "getAudioBySlug",
  (args) => contentAudioLookup_getAudioBySlug(args).pipe(Effect.orDie)
);

const audioStudiesMutationsContentAudiosImpl = GroupImpl.make(
  api,
  "audioStudies.mutations.contentAudios"
)
  .pipe(
    Layer.provide(
      audioStudies_mutations_contentAudios_claimScriptGenerationImpl
    )
  )
  .pipe(
    Layer.provide(
      audioStudies_mutations_contentAudios_claimSpeechGenerationImpl
    )
  )
  .pipe(
    Layer.provide(
      audioStudies_mutations_contentAudios_createOrGetAudioRecordImpl
    )
  )
  .pipe(Layer.provide(audioStudies_mutations_contentAudios_markFailedImpl))
  .pipe(Layer.provide(audioStudies_mutations_contentAudios_saveAudioImpl))
  .pipe(Layer.provide(audioStudies_mutations_contentAudios_saveScriptImpl))
  .pipe(
    Layer.provide(audioStudies_mutations_contentAudios_updateContentHashImpl)
  );

const audioStudiesMutationsQueueImpl = GroupImpl.make(
  api,
  "audioStudies.mutations.queue"
)
  .pipe(Layer.provide(audioStudies_mutations_queue_cleanupImpl))
  .pipe(Layer.provide(audioStudies_mutations_queue_lockQueueItemImpl))
  .pipe(Layer.provide(audioStudies_mutations_queue_markQueueFailedImpl))
  .pipe(Layer.provide(audioStudies_mutations_queue_markQueueCompletedImpl))
  .pipe(Layer.provide(audioStudies_mutations_queue_resetStuckQueueItemsImpl))
  .pipe(
    Layer.provide(
      audioStudies_mutations_queue_startWorkflowsForPendingItemsImpl
    )
  );

const audioStudiesQueriesInternalImpl = GroupImpl.make(
  api,
  "audioStudies.queries.internalFunctions"
)
  .pipe(
    Layer.provide(
      audioStudies_queries_internal_getAudioAndContentForScriptGenerationImpl
    )
  )
  .pipe(
    Layer.provide(audioStudies_queries_internal_getAudioForSpeechGenerationImpl)
  )
  .pipe(Layer.provide(audioStudies_queries_internal_verifyContentHashImpl))
  .pipe(Layer.provide(audioStudies_queries_internal_getContentHashImpl));

const audioStudiesQueriesPublicImpl = GroupImpl.make(
  api,
  "audioStudies.queries.publicFunctions"
).pipe(Layer.provide(audioStudies_queries_public_getAudioBySlugImpl));

const audioStudiesMutationsImpl = GroupImpl.make(api, "audioStudies.mutations")
  .pipe(Layer.provide(audioStudiesMutationsContentAudiosImpl))
  .pipe(Layer.provide(audioStudiesMutationsQueueImpl));

const audioStudiesQueriesImpl = GroupImpl.make(api, "audioStudies.queries")
  .pipe(Layer.provide(audioStudiesQueriesInternalImpl))
  .pipe(Layer.provide(audioStudiesQueriesPublicImpl));

const audioStudiesWorkflowsImpl = GroupImpl.make(api, "audioStudies.workflows")
  .pipe(Layer.provide(audioStudies_workflows_generateAudioForQueueItemImpl))
  .pipe(Layer.provide(audioStudies_workflows_handleWorkflowCompleteImpl));

const audioStudiesImpl = GroupImpl.make(api, "audioStudies")
  .pipe(Layer.provide(audioStudiesMutationsImpl))
  .pipe(Layer.provide(audioStudiesQueriesImpl))
  .pipe(Layer.provide(audioStudiesWorkflowsImpl));

export const audioStudiesLayer = Layer.mergeAll(audioStudiesImpl);
