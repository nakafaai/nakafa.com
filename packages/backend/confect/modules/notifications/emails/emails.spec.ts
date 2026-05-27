import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const emailsMutationsGroup = GroupSpec.make("mutations").addFunction(
  FunctionSpec.internalMutation({
    name: "sendWelcomeEmail",
    args: Schema.Struct({ email: Schema.String, name: Schema.String }),
    returns: Schema.Null,
  })
);

export { emailsMutationsGroup };

const emailsGroup = GroupSpec.make("emails").addGroup(emailsMutationsGroup);

export { emailsGroup };
