import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReminderEmailInputSchema } from "@repo/email/templates/reminder/content";
import {
  ReminderEmailInputError,
  ReminderEmailRenderError,
} from "@repo/email/templates/reminder/contract";
import { Schema } from "effect";

/** Renders a try-out reminder email in the Node runtime, where the email package runs. */
export default GroupSpec.makeNode().addFunction(
  FunctionSpec.internalNodeAction({
    name: "render",
    args: () => ReminderEmailInputSchema.fields,
    returns: () =>
      Schema.Struct({
        html: Schema.String,
        subject: Schema.String,
        text: Schema.String,
      }),
    error: () =>
      Schema.Union([ReminderEmailInputError, ReminderEmailRenderError]),
  })
);
