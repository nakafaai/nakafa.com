import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  bulkSyncAuthors as contentSyncAuthors_bulkSyncAuthors,
  deleteUnusedAuthors as contentSyncAuthors_deleteUnusedAuthors,
} from "@repo/backend/confect/modules/content/contentSyncAuthors.service";
import { Effect, Layer } from "effect";

const contentSync_mutations_authors_bulkSyncAuthorsImpl = FunctionImpl.make(
  api,
  "contentSync.mutations.authors",
  "bulkSyncAuthors",
  (args) =>
    contentSyncAuthors_bulkSyncAuthors(args).pipe(
      Effect.catchTag("ContentSyncError", (error) => Effect.die(error)),
      Effect.orDie
    )
);

const contentSync_mutations_authors_deleteUnusedAuthorsImpl = FunctionImpl.make(
  api,
  "contentSync.mutations.authors",
  "deleteUnusedAuthors",
  (args) =>
    contentSyncAuthors_deleteUnusedAuthors(args).pipe(
      Effect.catchTag("ContentSyncError", (error) => Effect.die(error)),
      Effect.orDie
    )
);

const contentSyncMutationsAuthorsImpl = GroupImpl.make(
  api,
  "contentSync.mutations.authors"
)
  .pipe(Layer.provide(contentSync_mutations_authors_bulkSyncAuthorsImpl))
  .pipe(Layer.provide(contentSync_mutations_authors_deleteUnusedAuthorsImpl));

export { contentSyncMutationsAuthorsImpl };
