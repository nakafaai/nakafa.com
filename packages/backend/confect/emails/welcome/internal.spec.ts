import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import { welcomeIntentInputValidator } from "@repo/backend/confect/emails/welcome/schema";
import {
  WelcomeIntentDeferredErrorWire,
  WelcomeIntentErrorWire,
} from "@repo/backend/confect/emails/welcome/spec";
import { SiteConfigErrorWire } from "@repo/backend/confect/site/spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "readIntentInput",
      args: () => ({
        intentId: IdSchema("welcomeEmailIntents"),
      }),
      returns: () => welcomeIntentInputValidator,
      error: () =>
        Schema.Union([
          WelcomeIntentErrorWire,
          WelcomeIntentDeferredErrorWire,
          ReleaseErrorWire,
          SiteConfigErrorWire,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "enqueueRenderedWelcome",
      args: () => ({
        intentId: IdSchema("welcomeEmailIntents"),
        html: Schema.String,
        subject: Schema.String,
        text: Schema.String,
      }),
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([WelcomeIntentErrorWire, WelcomeIntentDeferredErrorWire]),
    })
  );
