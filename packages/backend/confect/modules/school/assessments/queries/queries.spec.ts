import { GroupSpec } from "@confect/core";
import { assessmentsQueriesPublicGroup } from "./publicFunctions/publicFunctions.spec";

const assessmentsQueriesGroup = GroupSpec.make("queries").addGroup(
  assessmentsQueriesPublicGroup
);

export { assessmentsQueriesGroup };
