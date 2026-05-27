import { GroupSpec } from "@confect/core";
import { tryoutsMutationsGroup } from "./mutations/mutations.spec";
import { tryoutsQueriesGroup } from "./queries/queries.spec";

const tryoutsGroup = GroupSpec.make("tryouts")
  .addGroup(tryoutsMutationsGroup)
  .addGroup(tryoutsQueriesGroup);

export { tryoutsGroup };
