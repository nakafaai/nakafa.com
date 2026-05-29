import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  getAudioBySlug,
  getContentHash,
} from "@repo/backend/confect/modules/content/audioContentLookup.service";
import {
  claimScriptGeneration,
  claimSpeechGeneration,
  createOrGetAudioRecord,
  getAudioAndContentForScriptGeneration,
  getAudioForSpeechGeneration,
  markFailed,
  saveAudio,
  saveScript,
  updateContentHash,
  verifyContentHash,
} from "@repo/backend/confect/modules/content/audioContentRecords.service";
import {
  cleanup,
  lockQueueItem,
  markQueueCompleted,
  markQueueFailed,
  resetStuckQueueItems,
  startWorkflowsForPendingItems,
} from "@repo/backend/confect/modules/content/audioQueue.service";
import { generateScript } from "@repo/backend/confect/modules/content/audioScript.actions";
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
    (args) => claimScriptGeneration(args).pipe(Effect.orDie)
  );
const audioStudies_mutations_contentAudios_claimSpeechGenerationImpl =
  FunctionImpl.make(
    api,
    "audioStudies.mutations.contentAudios",
    "claimSpeechGeneration",
    (args) => claimSpeechGeneration(args).pipe(Effect.orDie)
  );
const audioStudies_mutations_contentAudios_createOrGetAudioRecordImpl =
  FunctionImpl.make(
    api,
    "audioStudies.mutations.contentAudios",
    "createOrGetAudioRecord",
    (args) => createOrGetAudioRecord(args).pipe(Effect.orDie)
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
const audioStudies_actions_generateScriptImpl = FunctionImpl.make(
  api,
  "audioStudies.actions",
  "generateScript",
  (args) => generateScript(args).pipe(Effect.orDie)
);
const audioStudies_mutations_contentAudios_markFailedImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.contentAudios",
  "markFailed",
  (args) => markFailed(args).pipe(Effect.orDie)
);
const audioStudies_mutations_contentAudios_saveAudioImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.contentAudios",
  "saveAudio",
  (args) => saveAudio(args).pipe(Effect.orDie)
);
const audioStudies_mutations_contentAudios_saveScriptImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.contentAudios",
  "saveScript",
  (args) => saveScript(args).pipe(Effect.orDie)
);
const audioStudies_mutations_contentAudios_updateContentHashImpl =
  FunctionImpl.make(
    api,
    "audioStudies.mutations.contentAudios",
    "updateContentHash",
    (args) => updateContentHash(args).pipe(Effect.orDie)
  );
const audioStudies_mutations_queue_cleanupImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.queue",
  "cleanup",
  (_args) => cleanup().pipe(Effect.orDie)
);
const audioStudies_mutations_queue_lockQueueItemImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.queue",
  "lockQueueItem",
  (args) => lockQueueItem(args).pipe(Effect.orDie)
);
const audioStudies_mutations_queue_markQueueFailedImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.queue",
  "markQueueFailed",
  (args) => markQueueFailed(args).pipe(Effect.orDie)
);
const audioStudies_mutations_queue_markQueueCompletedImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.queue",
  "markQueueCompleted",
  (args) => markQueueCompleted(args.queueItemId).pipe(Effect.orDie)
);
const audioStudies_mutations_queue_resetStuckQueueItemsImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.queue",
  "resetStuckQueueItems",
  (_args) => resetStuckQueueItems().pipe(Effect.orDie)
);
const audioStudies_mutations_queue_startWorkflowsForPendingItemsImpl =
  FunctionImpl.make(
    api,
    "audioStudies.mutations.queue",
    "startWorkflowsForPendingItems",
    (_args) => startWorkflowsForPendingItems().pipe(Effect.orDie)
  );
const audioStudies_queries_internal_getAudioAndContentForScriptGenerationImpl =
  FunctionImpl.make(
    api,
    "audioStudies.queries.internalFunctions",
    "getAudioAndContentForScriptGeneration",
    (args) => getAudioAndContentForScriptGeneration(args).pipe(Effect.orDie)
  );
const audioStudies_queries_internal_getAudioForSpeechGenerationImpl =
  FunctionImpl.make(
    api,
    "audioStudies.queries.internalFunctions",
    "getAudioForSpeechGeneration",
    (args) => getAudioForSpeechGeneration(args).pipe(Effect.orDie)
  );
const audioStudies_queries_internal_verifyContentHashImpl = FunctionImpl.make(
  api,
  "audioStudies.queries.internalFunctions",
  "verifyContentHash",
  (args) => verifyContentHash(args).pipe(Effect.orDie)
);
const audioStudies_queries_internal_getContentHashImpl = FunctionImpl.make(
  api,
  "audioStudies.queries.internalFunctions",
  "getContentHash",
  (args) => getContentHash(args).pipe(Effect.orDie)
);
const audioStudies_queries_public_getAudioBySlugImpl = FunctionImpl.make(
  api,
  "audioStudies.queries.publicFunctions",
  "getAudioBySlug",
  (args) => getAudioBySlug(args).pipe(Effect.orDie)
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
const audioStudiesActionsImpl = GroupImpl.make(
  api,
  "audioStudies.actions"
).pipe(Layer.provide(audioStudies_actions_generateScriptImpl));
const audioStudiesImpl = GroupImpl.make(api, "audioStudies")
  .pipe(Layer.provide(audioStudiesActionsImpl))
  .pipe(Layer.provide(audioStudiesMutationsImpl))
  .pipe(Layer.provide(audioStudiesQueriesImpl))
  .pipe(Layer.provide(audioStudiesWorkflowsImpl));
export const audioStudiesLayer = Layer.mergeAll(audioStudiesImpl);
