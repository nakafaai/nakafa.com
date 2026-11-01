import { FunctionSpec, GroupSpec } from "@confect/core";
import { DigestEmailInputSchema } from "@repo/email/templates/digest/content";
import {
  DigestEmailInputError,
  DigestEmailRenderError,
} from "@repo/email/templates/digest/contract";
import { Schema } from "effect";

/** Renders a digest email in the Node runtime, where the email package runs. */
export default GroupSpec.makeNode().addFunction(
  FunctionSpec.internalNodeAction({
    name: "render",
    args: () => DigestEmailInputSchema.fields,
    returns: () =>
      Schema.Struct({
        html: Schema.String,
        subject: Schema.String,
        text: Schema.String,
      }),
    error: () => Schema.Union([DigestEmailInputError, DigestEmailRenderError]),
  })
);
