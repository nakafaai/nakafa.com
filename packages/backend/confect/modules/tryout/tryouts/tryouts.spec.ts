import { GroupSpec } from "@confect/core";
import { tryoutsMutationsGroup } from "@repo/backend/confect/modules/tryout/tryouts/mutations/mutations.spec";
import { tryoutsQueriesGroup } from "@repo/backend/confect/modules/tryout/tryouts/queries/queries.spec";

const tryoutsGroup = GroupSpec.make("tryouts")
  .addGroup(tryoutsMutationsGroup)
  .addGroup(tryoutsQueriesGroup);

export { tryoutsGroup };
