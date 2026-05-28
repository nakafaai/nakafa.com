import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  bulkSyncArticles as contentSyncArticles_bulkSyncArticles,
  deleteStaleArticles as contentSyncArticles_deleteStaleArticles,
} from "@repo/backend/confect/modules/content/contentSyncArticles.service";
import { Effect, Layer } from "effect";

const contentSync_mutations_articles_bulkSyncArticlesImpl = FunctionImpl.make(
  api,
  "contentSync.mutations.articles",
  "bulkSyncArticles",
  (args) =>
    contentSyncArticles_bulkSyncArticles(args).pipe(
      Effect.catchTag("ContentSyncError", (error) => Effect.die(error))
    )
);

const contentSync_mutations_articles_deleteStaleArticlesImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.articles",
    "deleteStaleArticles",
    (args) =>
      contentSyncArticles_deleteStaleArticles(args).pipe(
        Effect.catchTag("ContentSyncError", (error) => Effect.die(error))
      )
  );

const contentSyncMutationsArticlesImpl = GroupImpl.make(
  api,
  "contentSync.mutations.articles"
)
  .pipe(Layer.provide(contentSync_mutations_articles_bulkSyncArticlesImpl))
  .pipe(Layer.provide(contentSync_mutations_articles_deleteStaleArticlesImpl));

export { contentSyncMutationsArticlesImpl };
