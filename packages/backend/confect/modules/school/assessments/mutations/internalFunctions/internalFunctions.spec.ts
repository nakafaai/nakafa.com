import { GroupSpec } from "@confect/core";
import { assessmentsMutationsInternalPublishingGroup } from "@repo/backend/confect/modules/school/assessments/mutations/internalFunctions/publishing.spec";

const assessmentsMutationsInternalGroup = GroupSpec.make(
  "internalFunctions"
).addGroup(assessmentsMutationsInternalPublishingGroup);

export { assessmentsMutationsInternalGroup };
