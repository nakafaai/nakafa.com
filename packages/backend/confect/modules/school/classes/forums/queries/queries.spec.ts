import { GroupSpec } from "@confect/core";
import { classesForumsQueriesForumsGroup } from "./forums.spec";
import { classesForumsQueriesPagesGroup } from "./pages.spec";

const classesForumsQueriesGroup = GroupSpec.make("queries")
  .addGroup(classesForumsQueriesForumsGroup)
  .addGroup(classesForumsQueriesPagesGroup);

export { classesForumsQueriesGroup };
