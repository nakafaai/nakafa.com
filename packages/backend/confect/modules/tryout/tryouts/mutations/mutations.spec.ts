import { GroupSpec } from "@confect/core";
import { tryoutsMutationsAttemptsGroup } from "@repo/backend/confect/modules/tryout/tryouts/mutations/attempts.spec";
import { tryoutsMutationsInternalGroup } from "@repo/backend/confect/modules/tryout/tryouts/mutations/internalFunctions/internalFunctions.spec";

const tryoutsMutationsGroup = GroupSpec.make("mutations")
  .addGroup(tryoutsMutationsAttemptsGroup)
  .addGroup(tryoutsMutationsInternalGroup);

export { tryoutsMutationsGroup };
