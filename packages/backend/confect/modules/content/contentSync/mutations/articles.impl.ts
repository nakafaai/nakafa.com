import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  bulkSyncArticles,
  deleteStaleArticles,
} from "@repo/backend/confect/modules/content/contentSyncArticles.service";
import { Effect, Layer } from "effect";

const contentSync_mutations_articles_bulkSyncArticlesImpl = FunctionImpl.make(
  api,
  "contentSync.mutations.articles",
  "bulkSyncArticles",
  (args) =>
    bulkSyncArticles(args).pipe(
      Effect.catchTag("ContentSyncError", (error) => Effect.die(error)),
      Effect.orDie
    )
);

const contentSync_mutations_articles_deleteStaleArticlesImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.articles",
    "deleteStaleArticles",
    (args) =>
      deleteStaleArticles(args).pipe(
        Effect.catchTag("ContentSyncError", (error) => Effect.die(error)),
        Effect.orDie
      )
  );

const contentSyncMutationsArticlesImpl = GroupImpl.make(
  api,
  "contentSync.mutations.articles"
)
  .pipe(Layer.provide(contentSync_mutations_articles_bulkSyncArticlesImpl))
  .pipe(Layer.provide(contentSync_mutations_articles_deleteStaleArticlesImpl));

export { contentSyncMutationsArticlesImpl };
