import { GroupSpec } from "@confect/core";
import { assessmentsQueriesPublicAssignmentGroup } from "@repo/backend/confect/modules/school/assessments/queries/publicFunctions/assignment.spec";
import { assessmentsQueriesPublicAuthoringGroup } from "@repo/backend/confect/modules/school/assessments/queries/publicFunctions/authoring.spec";
import { assessmentsQueriesPublicBankGroup } from "@repo/backend/confect/modules/school/assessments/queries/publicFunctions/bank.spec";
import { assessmentsQueriesPublicListGroup } from "@repo/backend/confect/modules/school/assessments/queries/publicFunctions/list.spec";

const assessmentsQueriesPublicGroup = GroupSpec.make("publicFunctions")
  .addGroup(assessmentsQueriesPublicAuthoringGroup)
  .addGroup(assessmentsQueriesPublicAssignmentGroup)
  .addGroup(assessmentsQueriesPublicBankGroup)
  .addGroup(assessmentsQueriesPublicListGroup);

export { assessmentsQueriesPublicGroup };
