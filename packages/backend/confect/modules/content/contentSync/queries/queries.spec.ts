import { GroupSpec } from "@confect/core";
import { contentSyncQueriesAuthorsGroup } from "@repo/backend/confect/modules/content/contentSync/queries/authors.spec";
import { contentSyncQueriesCountsGroup } from "@repo/backend/confect/modules/content/contentSync/queries/counts.spec";
import { contentSyncQueriesIntegrityGroup } from "@repo/backend/confect/modules/content/contentSync/queries/integrity.spec";
import { contentSyncQueriesStaleGroup } from "@repo/backend/confect/modules/content/contentSync/queries/stale.spec";
import { contentSyncQueriesTryoutsGroup } from "@repo/backend/confect/modules/content/contentSync/queries/tryouts.spec";

const contentSyncQueriesGroup = GroupSpec.make("queries")
  .addGroup(contentSyncQueriesAuthorsGroup)
  .addGroup(contentSyncQueriesCountsGroup)
  .addGroup(contentSyncQueriesIntegrityGroup)
  .addGroup(contentSyncQueriesStaleGroup)
  .addGroup(contentSyncQueriesTryoutsGroup);

export { contentSyncQueriesGroup };
