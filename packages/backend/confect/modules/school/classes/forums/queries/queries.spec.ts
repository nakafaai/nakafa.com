import { GroupSpec } from "@confect/core";
import { classesForumsQueriesForumsGroup } from "@repo/backend/confect/modules/school/classes/forums/queries/forums.spec";
import { classesForumsQueriesPagesGroup } from "@repo/backend/confect/modules/school/classes/forums/queries/pages.spec";

const classesForumsQueriesGroup = GroupSpec.make("queries")
  .addGroup(classesForumsQueriesForumsGroup)
  .addGroup(classesForumsQueriesPagesGroup);

export { classesForumsQueriesGroup };
