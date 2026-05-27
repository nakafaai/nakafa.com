import { GroupSpec } from "@confect/core";
import { classesMaterialsMutationsGroup } from "./mutations.spec";
import { classesMaterialsQueriesGroup } from "./queries.spec";

const classesMaterialsGroup = GroupSpec.make("materials")
  .addGroup(classesMaterialsMutationsGroup)
  .addGroup(classesMaterialsQueriesGroup);

export { classesMaterialsGroup };
