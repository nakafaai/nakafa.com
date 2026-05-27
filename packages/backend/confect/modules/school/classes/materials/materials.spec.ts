import { GroupSpec } from "@confect/core";
import { classesMaterialsMutationsGroup } from "@repo/backend/confect/modules/school/classes/materials/mutations.spec";
import { classesMaterialsQueriesGroup } from "@repo/backend/confect/modules/school/classes/materials/queries.spec";

const classesMaterialsGroup = GroupSpec.make("materials")
  .addGroup(classesMaterialsMutationsGroup)
  .addGroup(classesMaterialsQueriesGroup);

export { classesMaterialsGroup };
