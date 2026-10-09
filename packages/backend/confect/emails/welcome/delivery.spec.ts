import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { WelcomeIntentError } from "@repo/backend/confect/emails/welcome/spec";
import {
  AccountReadyEmailInputError,
  AccountReadyEmailRenderError,
} from "@repo/email/templates/ready/contract";
import { Schema } from "effect";
export default GroupSpec.makeNode().addFunction(
  FunctionSpec.internalNodeAction({
    name: "sendWelcomeEmail",
    args: () => ({
      intentId: IdSchema("welcomeEmailIntents"),
    }),
    returns: () => Schema.Null,
    error: () =>
      Schema.Union([
        WelcomeIntentError,
        AccountReadyEmailInputError,
        AccountReadyEmailRenderError,
      ]),
  })
);
