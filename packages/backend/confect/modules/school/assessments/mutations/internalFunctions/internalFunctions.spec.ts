import { GroupSpec } from "@confect/core";
import { assessmentsMutationsInternalPublishingGroup } from "./publishing.spec";

const assessmentsMutationsInternalGroup = GroupSpec.make(
  "internalFunctions"
).addGroup(assessmentsMutationsInternalPublishingGroup);

export { assessmentsMutationsInternalGroup };
