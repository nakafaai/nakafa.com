import { GroupSpec } from "@confect/core";
import { contentSyncMutationsArticlesGroup } from "@repo/backend/confect/modules/content/contentSync/mutations/articles.spec";
import { contentSyncMutationsAuthorsGroup } from "@repo/backend/confect/modules/content/contentSync/mutations/authors.spec";
import { contentSyncMutationsExercisesGroup } from "@repo/backend/confect/modules/content/contentSync/mutations/exercises.spec";
import { contentSyncMutationsMaintenanceGroup } from "@repo/backend/confect/modules/content/contentSync/mutations/maintenance.spec";
import { contentSyncMutationsSubjectsGroup } from "@repo/backend/confect/modules/content/contentSync/mutations/subjects.spec";
import { contentSyncMutationsTryoutsGroup } from "@repo/backend/confect/modules/content/contentSync/mutations/tryouts.spec";

const contentSyncMutationsGroup = GroupSpec.make("mutations")
  .addGroup(contentSyncMutationsArticlesGroup)
  .addGroup(contentSyncMutationsAuthorsGroup)
  .addGroup(contentSyncMutationsExercisesGroup)
  .addGroup(contentSyncMutationsMaintenanceGroup)
  .addGroup(contentSyncMutationsSubjectsGroup)
  .addGroup(contentSyncMutationsTryoutsGroup);

export { contentSyncMutationsGroup };
