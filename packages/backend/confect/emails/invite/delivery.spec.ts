import { FunctionSpec, GroupSpec } from "@confect/core";
import { InviteEmailInputSchema } from "@repo/email/templates/invite/content";
import {
  InviteEmailInputError,
  InviteEmailRenderError,
} from "@repo/email/templates/invite/contract";
import { Schema } from "effect";

/** Renders the invitation in the Node runtime, where the email package runs. */
export default GroupSpec.makeNode().addFunction(
  FunctionSpec.internalNodeAction({
    name: "render",
    args: () => InviteEmailInputSchema.fields,
    returns: () =>
      Schema.Struct({
        html: Schema.String,
        subject: Schema.String,
        text: Schema.String,
      }),
    error: () => Schema.Union([InviteEmailInputError, InviteEmailRenderError]),
  })
);
