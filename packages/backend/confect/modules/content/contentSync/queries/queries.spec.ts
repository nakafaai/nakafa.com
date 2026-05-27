import { GroupSpec } from "@confect/core";
import { contentSyncQueriesAuthorsGroup } from "./authors.spec";
import { contentSyncQueriesCountsGroup } from "./counts.spec";
import { contentSyncQueriesIntegrityGroup } from "./integrity.spec";
import { contentSyncQueriesStaleGroup } from "./stale.spec";
import { contentSyncQueriesTryoutsGroup } from "./tryouts.spec";

const contentSyncQueriesGroup = GroupSpec.make("queries")
  .addGroup(contentSyncQueriesAuthorsGroup)
  .addGroup(contentSyncQueriesCountsGroup)
  .addGroup(contentSyncQueriesIntegrityGroup)
  .addGroup(contentSyncQueriesStaleGroup)
  .addGroup(contentSyncQueriesTryoutsGroup);

export { contentSyncQueriesGroup };
