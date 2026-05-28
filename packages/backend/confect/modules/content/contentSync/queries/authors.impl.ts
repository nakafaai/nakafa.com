import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { listAuthorsPage } from "@repo/backend/confect/modules/content/contentSyncAuthors.service";
import { Effect, Layer } from "effect";

const contentSync_queries_authors_listAuthorsPageImpl = FunctionImpl.make(
  api,
  "contentSync.queries.authors",
  "listAuthorsPage",
  (args) => listAuthorsPage(args).pipe(Effect.orDie)
);
const contentSyncQueriesAuthorsImpl = GroupImpl.make(
  api,
  "contentSync.queries.authors"
).pipe(Layer.provide(contentSync_queries_authors_listAuthorsPageImpl));

export { contentSyncQueriesAuthorsImpl };
