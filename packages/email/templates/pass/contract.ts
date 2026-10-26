import { Schema } from "effect";

/** Expected invalid input at the pass reminder email boundary. */
export class PassEndingEmailInputError extends Schema.TaggedError<PassEndingEmailInputError>()(
  "PassEndingEmailInputError",
  {
    code: Schema.Literal("PASS_ENDING_EMAIL_INPUT_INVALID"),
    message: Schema.String,
  }
) {}

/** Expected failure while rendering a pass reminder email. */
export class PassEndingEmailRenderError extends Schema.TaggedError<PassEndingEmailRenderError>()(
  "PassEndingEmailRenderError",
  {
    code: Schema.Literal("PASS_ENDING_EMAIL_RENDER_FAILED"),
    message: Schema.String,
  }
) {}
