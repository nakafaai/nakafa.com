import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as content_sync_articles from "@repo/backend/confect/modules/content/contentSyncArticles.service";
import { Effect, Layer } from "effect";

const contentSync_mutations_articles_bulkSyncArticlesImpl = FunctionImpl.make(
  api,
  "contentSync.mutations.articles",
  "bulkSyncArticles",
  (args) =>
    content_sync_articles
      .bulkSyncArticles(args)
      .pipe(Effect.catchTag("ContentSyncError", (error) => Effect.die(error)))
);

const contentSync_mutations_articles_deleteStaleArticlesImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.articles",
    "deleteStaleArticles",
    (args) =>
      content_sync_articles
        .deleteStaleArticles(args)
        .pipe(Effect.catchTag("ContentSyncError", (error) => Effect.die(error)))
  );

const contentSyncMutationsArticlesImpl = GroupImpl.make(
  api,
  "contentSync.mutations.articles"
)
  .pipe(Layer.provide(contentSync_mutations_articles_bulkSyncArticlesImpl))
  .pipe(Layer.provide(contentSync_mutations_articles_deleteStaleArticlesImpl));

export { contentSyncMutationsArticlesImpl };
