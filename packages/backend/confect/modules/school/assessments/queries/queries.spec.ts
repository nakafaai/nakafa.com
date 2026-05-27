import { GroupSpec } from "@confect/core";
import { assessmentsQueriesPublicGroup } from "@repo/backend/confect/modules/school/assessments/queries/publicFunctions/publicFunctions.spec";

const assessmentsQueriesGroup = GroupSpec.make("queries").addGroup(
  assessmentsQueriesPublicGroup
);

export { assessmentsQueriesGroup };
