import { GroupSpec } from "@confect/core";
import { classesForumsGroup } from "./forums/forums.spec";
import { classesMaterialsGroup } from "./materials/materials.spec";
import { classesMutationsGroup } from "./mutations.spec";
import { classesQueriesGroup } from "./queries.spec";

const classesGroup = GroupSpec.make("classes")
  .addGroup(classesMaterialsGroup)
  .addGroup(classesMutationsGroup)
  .addGroup(classesQueriesGroup)
  .addGroup(classesForumsGroup);

export { classesGroup };
