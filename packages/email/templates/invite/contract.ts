import { Schema } from "effect";

/** Expected invalid input at the invitation email boundary. */
export class InviteEmailInputError extends Schema.TaggedError<InviteEmailInputError>()(
  "InviteEmailInputError",
  {
    code: Schema.Literal("INVITE_EMAIL_INPUT_INVALID"),
    message: Schema.String,
  }
) {}

/** Expected failure while rendering an invitation email. */
export class InviteEmailRenderError extends Schema.TaggedError<InviteEmailRenderError>()(
  "InviteEmailRenderError",
  {
    code: Schema.Literal("INVITE_EMAIL_RENDER_FAILED"),
    message: Schema.String,
  }
) {}
