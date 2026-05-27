import { GroupSpec } from "@confect/core";
import { assessmentsMutationsInternalGroup } from "@repo/backend/confect/modules/school/assessments/mutations/internalFunctions/internalFunctions.spec";
import { assessmentsMutationsPublicGroup } from "@repo/backend/confect/modules/school/assessments/mutations/publicFunctions/publicFunctions.spec";

const assessmentsMutationsGroup = GroupSpec.make("mutations")
  .addGroup(assessmentsMutationsPublicGroup)
  .addGroup(assessmentsMutationsInternalGroup);

export { assessmentsMutationsGroup };
