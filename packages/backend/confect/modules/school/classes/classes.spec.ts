import { GroupSpec } from "@confect/core";
import { classesForumsGroup } from "@repo/backend/confect/modules/school/classes/forums/forums.spec";
import { classesMaterialsGroup } from "@repo/backend/confect/modules/school/classes/materials/materials.spec";
import { classesMutationsGroup } from "@repo/backend/confect/modules/school/classes/mutations.spec";
import { classesQueriesGroup } from "@repo/backend/confect/modules/school/classes/queries.spec";

const classesGroup = GroupSpec.make("classes")
  .addGroup(classesMaterialsGroup)
  .addGroup(classesMutationsGroup)
  .addGroup(classesQueriesGroup)
  .addGroup(classesForumsGroup);

export { classesGroup };
