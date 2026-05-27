import { GroupSpec } from "@confect/core";
import { assessmentsQueriesPublicAssignmentGroup } from "./assignment.spec";
import { assessmentsQueriesPublicAuthoringGroup } from "./authoring.spec";
import { assessmentsQueriesPublicBankGroup } from "./bank.spec";
import { assessmentsQueriesPublicListGroup } from "./list.spec";

const assessmentsQueriesPublicGroup = GroupSpec.make("publicFunctions")
  .addGroup(assessmentsQueriesPublicAuthoringGroup)
  .addGroup(assessmentsQueriesPublicAssignmentGroup)
  .addGroup(assessmentsQueriesPublicBankGroup)
  .addGroup(assessmentsQueriesPublicListGroup);

export { assessmentsQueriesPublicGroup };
