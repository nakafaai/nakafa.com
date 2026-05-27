import { GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { Layer } from "effect";
import { contentSyncMutationsImpl } from "./mutations/mutations.impl";
import { contentSyncQueriesImpl } from "./queries/queries.impl";

const contentSyncImpl = GroupImpl.make(api, "contentSync")
  .pipe(Layer.provide(contentSyncMutationsImpl))
  .pipe(Layer.provide(contentSyncQueriesImpl));

export const contentSyncLayer = Layer.mergeAll(contentSyncImpl);
