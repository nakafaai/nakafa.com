import { GroupSpec } from "@confect/core";
import { contentSyncMutationsGroup } from "@repo/backend/confect/modules/content/contentSync/mutations/mutations.spec";
import { contentSyncQueriesGroup } from "@repo/backend/confect/modules/content/contentSync/queries/queries.spec";

const contentSyncGroup = GroupSpec.make("contentSync")
  .addGroup(contentSyncMutationsGroup)
  .addGroup(contentSyncQueriesGroup);

export { contentSyncGroup };
