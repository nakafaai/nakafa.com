import { GroupSpec } from "@confect/core";
import { classesForumsInternalMutationsGroup } from "@repo/backend/confect/modules/school/classes/forums/internalMutations.spec";
import { classesForumsMutationsGroup } from "@repo/backend/confect/modules/school/classes/forums/mutations/mutations.spec";
import { classesForumsQueriesGroup } from "@repo/backend/confect/modules/school/classes/forums/queries/queries.spec";

const classesForumsGroup = GroupSpec.make("forums")
  .addGroup(classesForumsMutationsGroup)
  .addGroup(classesForumsQueriesGroup)
  .addGroup(classesForumsInternalMutationsGroup);

export { classesForumsGroup };
