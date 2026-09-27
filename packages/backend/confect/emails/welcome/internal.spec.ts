import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { welcomeIntentInputValidator } from "@repo/backend/confect/emails/welcome/schema";
import {
  WelcomeIntentDeferredError,
  WelcomeIntentError,
} from "@repo/backend/confect/emails/welcome/spec";
import { SiteConfigError } from "@repo/backend/confect/site/spec";
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
          WelcomeIntentError,
          WelcomeIntentDeferredError,
          ReleaseError,
          SiteConfigError,
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
        Schema.Union([WelcomeIntentError, WelcomeIntentDeferredError]),
    })
  );
