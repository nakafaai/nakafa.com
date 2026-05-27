import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as content_sync_subjects from "@repo/backend/confect/modules/content/contentSyncSubjects.service";
import { Effect, Layer } from "effect";

const contentSync_mutations_subjects_bulkSyncSubjectSectionsImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.subjects",
    "bulkSyncSubjectSections",
    (args) =>
      content_sync_subjects
        .bulkSyncSubjectSections(args)
        .pipe(Effect.catchTag("ContentSyncError", (error) => Effect.die(error)))
  );

const contentSync_mutations_subjects_bulkSyncSubjectTopicsImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.subjects",
    "bulkSyncSubjectTopics",
    (args) =>
      content_sync_subjects
        .bulkSyncSubjectTopics(args)
        .pipe(Effect.catchTag("ContentSyncError", (error) => Effect.die(error)))
  );

const contentSync_mutations_subjects_deleteStaleSubjectSectionsImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.subjects",
    "deleteStaleSubjectSections",
    (args) =>
      content_sync_subjects
        .deleteStaleSubjectSections(args)
        .pipe(Effect.catchTag("ContentSyncError", (error) => Effect.die(error)))
  );

const contentSync_mutations_subjects_deleteStaleSubjectTopicsImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.subjects",
    "deleteStaleSubjectTopics",
    (args) =>
      content_sync_subjects
        .deleteStaleSubjectTopics(args)
        .pipe(Effect.catchTag("ContentSyncError", (error) => Effect.die(error)))
  );

const contentSyncMutationsSubjectsImpl = GroupImpl.make(
  api,
  "contentSync.mutations.subjects"
)
  .pipe(
    Layer.provide(contentSync_mutations_subjects_bulkSyncSubjectSectionsImpl)
  )
  .pipe(Layer.provide(contentSync_mutations_subjects_bulkSyncSubjectTopicsImpl))
  .pipe(
    Layer.provide(contentSync_mutations_subjects_deleteStaleSubjectSectionsImpl)
  )
  .pipe(
    Layer.provide(contentSync_mutations_subjects_deleteStaleSubjectTopicsImpl)
  );

export { contentSyncMutationsSubjectsImpl };
