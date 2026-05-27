import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as content_sync_authors from "@repo/backend/confect/modules/content/contentSyncAuthors.service";
import { Layer } from "effect";

const contentSync_queries_authors_listAuthorsPageImpl = FunctionImpl.make(
  api,
  "contentSync.queries.authors",
  "listAuthorsPage",
  (args) => content_sync_authors.listAuthorsPage(args)
);

const contentSyncQueriesAuthorsImpl = GroupImpl.make(
  api,
  "contentSync.queries.authors"
).pipe(Layer.provide(contentSync_queries_authors_listAuthorsPageImpl));

export { contentSyncQueriesAuthorsImpl };
