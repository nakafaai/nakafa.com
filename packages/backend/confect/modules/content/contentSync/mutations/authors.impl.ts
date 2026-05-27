import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as content_sync_authors from "@repo/backend/confect/modules/content/contentSyncAuthors.service";
import { Effect, Layer } from "effect";

const contentSync_mutations_authors_bulkSyncAuthorsImpl = FunctionImpl.make(
  api,
  "contentSync.mutations.authors",
  "bulkSyncAuthors",
  (args) =>
    content_sync_authors
      .bulkSyncAuthors(args)
      .pipe(Effect.catchTag("ContentSyncError", (error) => Effect.die(error)))
);

const contentSync_mutations_authors_deleteUnusedAuthorsImpl = FunctionImpl.make(
  api,
  "contentSync.mutations.authors",
  "deleteUnusedAuthors",
  (args) =>
    content_sync_authors
      .deleteUnusedAuthors(args)
      .pipe(Effect.catchTag("ContentSyncError", (error) => Effect.die(error)))
);

const contentSyncMutationsAuthorsImpl = GroupImpl.make(
  api,
  "contentSync.mutations.authors"
)
  .pipe(Layer.provide(contentSync_mutations_authors_bulkSyncAuthorsImpl))
  .pipe(Layer.provide(contentSync_mutations_authors_deleteUnusedAuthorsImpl));

export { contentSyncMutationsAuthorsImpl };
