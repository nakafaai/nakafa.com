import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as content_audio_lookup from "@repo/backend/confect/modules/content/audioContentLookup.service";
import * as content_audio_records from "@repo/backend/confect/modules/content/audioContentRecords.service";
import * as content_audio_queue from "@repo/backend/confect/modules/content/audioQueue.service";
import {
  generateAudioForQueueItem,
  handleWorkflowComplete,
} from "@repo/backend/confect/modules/content/audioStudies/workflows";
import { Layer } from "effect";

const audioStudies_mutations_contentAudios_claimScriptGenerationImpl =
  FunctionImpl.make(
    api,
    "audioStudies.mutations.contentAudios",
    "claimScriptGeneration",
    (args) => content_audio_records.claimScriptGeneration(args)
  );

const audioStudies_mutations_contentAudios_claimSpeechGenerationImpl =
  FunctionImpl.make(
    api,
    "audioStudies.mutations.contentAudios",
    "claimSpeechGeneration",
    (args) => content_audio_records.claimSpeechGeneration(args)
  );

const audioStudies_mutations_contentAudios_createOrGetAudioRecordImpl =
  FunctionImpl.make(
    api,
    "audioStudies.mutations.contentAudios",
    "createOrGetAudioRecord",
    (args) => content_audio_records.createOrGetAudioRecord(args)
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
  (args) => content_audio_records.markFailed(args)
);

const audioStudies_mutations_contentAudios_saveAudioImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.contentAudios",
  "saveAudio",
  (args) => content_audio_records.saveAudio(args)
);

const audioStudies_mutations_contentAudios_saveScriptImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.contentAudios",
  "saveScript",
  (args) => content_audio_records.saveScript(args)
);

const audioStudies_mutations_contentAudios_updateContentHashImpl =
  FunctionImpl.make(
    api,
    "audioStudies.mutations.contentAudios",
    "updateContentHash",
    (args) => content_audio_records.updateContentHash(args)
  );

const audioStudies_mutations_queue_cleanupImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.queue",
  "cleanup",
  (_args) => content_audio_queue.cleanup()
);

const audioStudies_mutations_queue_lockQueueItemImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.queue",
  "lockQueueItem",
  (args) => content_audio_queue.lockQueueItem(args)
);

const audioStudies_mutations_queue_markQueueFailedImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.queue",
  "markQueueFailed",
  (args) => content_audio_queue.markQueueFailed(args)
);

const audioStudies_mutations_queue_resetStuckQueueItemsImpl = FunctionImpl.make(
  api,
  "audioStudies.mutations.queue",
  "resetStuckQueueItems",
  (_args) => content_audio_queue.resetStuckQueueItems()
);

const audioStudies_mutations_queue_startWorkflowsForPendingItemsImpl =
  FunctionImpl.make(
    api,
    "audioStudies.mutations.queue",
    "startWorkflowsForPendingItems",
    (_args) => content_audio_queue.startWorkflowsForPendingItems()
  );

const audioStudies_queries_internal_getAudioAndContentForScriptGenerationImpl =
  FunctionImpl.make(
    api,
    "audioStudies.queries.internalFunctions",
    "getAudioAndContentForScriptGeneration",
    (args) => content_audio_records.getAudioAndContentForScriptGeneration(args)
  );

const audioStudies_queries_internal_getAudioForSpeechGenerationImpl =
  FunctionImpl.make(
    api,
    "audioStudies.queries.internalFunctions",
    "getAudioForSpeechGeneration",
    (args) => content_audio_records.getAudioForSpeechGeneration(args)
  );

const audioStudies_queries_internal_verifyContentHashImpl = FunctionImpl.make(
  api,
  "audioStudies.queries.internalFunctions",
  "verifyContentHash",
  (args) => content_audio_records.verifyContentHash(args)
);

const audioStudies_queries_internal_getContentHashImpl = FunctionImpl.make(
  api,
  "audioStudies.queries.internalFunctions",
  "getContentHash",
  (args) => content_audio_lookup.getContentHash(args)
);

const audioStudies_queries_public_getAudioBySlugImpl = FunctionImpl.make(
  api,
  "audioStudies.queries.publicFunctions",
  "getAudioBySlug",
  (args) => content_audio_lookup.getAudioBySlug(args)
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
