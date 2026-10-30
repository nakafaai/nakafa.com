import { FunctionSpec, GroupSpec } from "@confect/core";
import { NoticeEmailInputSchema } from "@repo/email/templates/notice/content";
import {
  NoticeEmailInputError,
  NoticeEmailRenderError,
} from "@repo/email/templates/notice/contract";
import { Schema } from "effect";

/** Renders a notice email in the Node runtime, where the email package runs. */
export default GroupSpec.makeNode().addFunction(
  FunctionSpec.internalNodeAction({
    name: "render",
    args: () => NoticeEmailInputSchema.fields,
    returns: () =>
      Schema.Struct({
        html: Schema.String,
        subject: Schema.String,
        text: Schema.String,
      }),
    error: () => Schema.Union([NoticeEmailInputError, NoticeEmailRenderError]),
  })
);
