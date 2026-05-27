import { GroupSpec } from "@confect/core";
import { tryoutsMutationsAttemptsGroup } from "./attempts.spec";
import { tryoutsMutationsInternalGroup } from "./internalFunctions/internalFunctions.spec";

const tryoutsMutationsGroup = GroupSpec.make("mutations")
  .addGroup(tryoutsMutationsAttemptsGroup)
  .addGroup(tryoutsMutationsInternalGroup);

export { tryoutsMutationsGroup };
