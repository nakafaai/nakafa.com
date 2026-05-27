import { GroupSpec } from "@confect/core";
import { contentSyncMutationsArticlesGroup } from "./articles.spec";
import { contentSyncMutationsAuthorsGroup } from "./authors.spec";
import { contentSyncMutationsExercisesGroup } from "./exercises.spec";
import { contentSyncMutationsMaintenanceGroup } from "./maintenance.spec";
import { contentSyncMutationsSubjectsGroup } from "./subjects.spec";
import { contentSyncMutationsTryoutsGroup } from "./tryouts.spec";

const contentSyncMutationsGroup = GroupSpec.make("mutations")
  .addGroup(contentSyncMutationsArticlesGroup)
  .addGroup(contentSyncMutationsAuthorsGroup)
  .addGroup(contentSyncMutationsExercisesGroup)
  .addGroup(contentSyncMutationsMaintenanceGroup)
  .addGroup(contentSyncMutationsSubjectsGroup)
  .addGroup(contentSyncMutationsTryoutsGroup);

export { contentSyncMutationsGroup };
