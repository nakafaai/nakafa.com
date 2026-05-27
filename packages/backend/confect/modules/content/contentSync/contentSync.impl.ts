import { GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { contentSyncMutationsImpl } from "@repo/backend/confect/modules/content/contentSync/mutations/mutations.impl";
import { contentSyncQueriesImpl } from "@repo/backend/confect/modules/content/contentSync/queries/queries.impl";
import { Layer } from "effect";

const contentSyncImpl = GroupImpl.make(api, "contentSync")
  .pipe(Layer.provide(contentSyncMutationsImpl))
  .pipe(Layer.provide(contentSyncQueriesImpl));

export const contentSyncLayer = Layer.mergeAll(contentSyncImpl);
