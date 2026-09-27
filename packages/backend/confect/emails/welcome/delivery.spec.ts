import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { WelcomeIntentErrorWire } from "@repo/backend/confect/emails/welcome/spec";
import { failureWire } from "@repo/backend/confect/failure";
import {
  AccountReadyEmailInputError,
  AccountReadyEmailRenderError,
} from "@repo/email/templates/ready/content";
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
        WelcomeIntentErrorWire,
        failureWire(AccountReadyEmailInputError),
        failureWire(AccountReadyEmailRenderError),
      ]),
  })
);
