import { GroupSpec } from "@confect/core";
import { assessmentsMutationsGroup } from "@repo/backend/confect/modules/school/assessments/mutations/mutations.spec";
import { assessmentsQueriesGroup } from "@repo/backend/confect/modules/school/assessments/queries/queries.spec";

const assessmentsGroup = GroupSpec.make("assessments")
  .addGroup(assessmentsMutationsGroup)
  .addGroup(assessmentsQueriesGroup);

export { assessmentsGroup };
