import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { SiteConfigError } from "@repo/backend/confect/site/spec";
import { ReminderJob } from "@repo/backend/confect/tryouts/reminders/schema";
import {
  ReminderEmailInputSchema,
  ReminderVariant,
} from "@repo/email/templates/reminder/content";
import { Schema } from "effect";

/**
 * A running try-out's reminders (decision D4): the inbox row and push an hour before it ends, and the email six hours
 * before, read, rendered in the Node runtime, and handed to the mail provider. Each job does nothing once the attempt
 * no longer runs to the end it was scheduled for.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "hour",
      args: () => ReminderJob.fields,
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "readEmail",
      args: () => ReminderJob.fields,
      returns: () =>
        Schema.Union([
          Schema.TaggedStruct("Skip", {}),
          Schema.TaggedStruct("Later", { at: Schema.Finite }),
          Schema.TaggedStruct("Send", {
            input: ReminderEmailInputSchema,
            userId: Id("users"),
          }),
        ]),
      error: () => Schema.Union([ReleaseError, SiteConfigError]),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "enqueueEmail",
      args: () => ({
        ...ReminderJob.fields,
        html: Schema.String,
        subject: Schema.String,
        text: Schema.String,
        variant: ReminderVariant,
      }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "email",
      args: () => ReminderJob.fields,
      returns: () => Schema.Null,
    })
  );
