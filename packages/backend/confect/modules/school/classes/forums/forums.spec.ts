import { GroupSpec } from "@confect/core";
import { classesForumsInternalMutationsGroup } from "./internalMutations.spec";
import { classesForumsMutationsGroup } from "./mutations/mutations.spec";
import { classesForumsQueriesGroup } from "./queries/queries.spec";

const classesForumsGroup = GroupSpec.make("forums")
  .addGroup(classesForumsMutationsGroup)
  .addGroup(classesForumsQueriesGroup)
  .addGroup(classesForumsInternalMutationsGroup);

export { classesForumsGroup };
