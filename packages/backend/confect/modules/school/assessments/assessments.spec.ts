import { GroupSpec } from "@confect/core";
import { assessmentsMutationsGroup } from "./mutations/mutations.spec";
import { assessmentsQueriesGroup } from "./queries/queries.spec";

const assessmentsGroup = GroupSpec.make("assessments")
  .addGroup(assessmentsMutationsGroup)
  .addGroup(assessmentsQueriesGroup);

export { assessmentsGroup };
