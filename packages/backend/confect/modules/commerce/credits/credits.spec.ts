import { FunctionSpec, GroupSpec } from "@confect/core";
import { userPlanSchema } from "@repo/backend/confect/modules/identity/users.tables";
import { Schema } from "effect";

const creditsMutationsGroup = GroupSpec.make("mutations")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "syncAllCreditResetPeriods",
      args: Schema.Struct({}),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "syncCreditResetPeriod",
      args: Schema.Struct({ plan: userPlanSchema }),
      returns: Schema.Null,
    })
  );

export { creditsMutationsGroup };

const creditsGroup = GroupSpec.make("credits").addGroup(creditsMutationsGroup);

export { creditsGroup };
