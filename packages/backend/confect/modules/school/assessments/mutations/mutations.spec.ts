import { GroupSpec } from "@confect/core";
import { assessmentsMutationsInternalGroup } from "./internalFunctions/internalFunctions.spec";
import { assessmentsMutationsPublicGroup } from "./publicFunctions/publicFunctions.spec";

const assessmentsMutationsGroup = GroupSpec.make("mutations")
  .addGroup(assessmentsMutationsPublicGroup)
  .addGroup(assessmentsMutationsInternalGroup);

export { assessmentsMutationsGroup };
