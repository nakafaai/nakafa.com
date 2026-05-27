import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as content_sync_tryouts from "@repo/backend/confect/modules/content/contentSyncTryouts.service";
import { Effect, Layer } from "effect";

const contentSync_mutations_tryouts_bulkSyncTryoutsImpl = FunctionImpl.make(
  api,
  "contentSync.mutations.tryouts",
  "bulkSyncTryouts",
  (args) =>
    content_sync_tryouts.bulkSyncTryouts(args).pipe(
      Effect.catchTags({
        ContentSyncError: (error) => Effect.die(error),
        IrtError: (error) => Effect.die(error),
      })
    )
);

const contentSyncMutationsTryoutsImpl = GroupImpl.make(
  api,
  "contentSync.mutations.tryouts"
).pipe(Layer.provide(contentSync_mutations_tryouts_bulkSyncTryoutsImpl));

export { contentSyncMutationsTryoutsImpl };
