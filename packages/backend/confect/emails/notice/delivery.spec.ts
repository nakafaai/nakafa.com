import { FunctionSpec, GroupSpec } from "@confect/core";
import { NoticeEmailInputSchema } from "@repo/email/templates/notice/content";
import {
  NoticeEmailInputError,
  NoticeEmailRenderError,
} from "@repo/email/templates/notice/contract";
import { Schema } from "effect";

/**
 * Renders the notice emails of one batch in the Node runtime, where the email package runs: one for each recipient,
 * in their order, since each carries its own unsubscribe link.
 */
export default GroupSpec.makeNode().addFunction(
  FunctionSpec.internalNodeAction({
    name: "render",
    args: () => ({ inputs: Schema.Array(NoticeEmailInputSchema) }),
    returns: () =>
      Schema.Array(
        Schema.Struct({
          html: Schema.String,
          subject: Schema.String,
          text: Schema.String,
        })
      ),
    error: () => Schema.Union([NoticeEmailInputError, NoticeEmailRenderError]),
  })
);
