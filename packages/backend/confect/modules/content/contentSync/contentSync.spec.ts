import { GroupSpec } from "@confect/core";
import { contentSyncMutationsGroup } from "./mutations/mutations.spec";
import { contentSyncQueriesGroup } from "./queries/queries.spec";

const contentSyncGroup = GroupSpec.make("contentSync")
  .addGroup(contentSyncMutationsGroup)
  .addGroup(contentSyncQueriesGroup);

export { contentSyncGroup };
