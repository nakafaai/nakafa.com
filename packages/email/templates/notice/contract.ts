import { Schema } from "effect";

/** Expected invalid input at the notice email boundary. */
export class NoticeEmailInputError extends Schema.TaggedError<NoticeEmailInputError>()(
  "NoticeEmailInputError",
  {
    code: Schema.Literal("NOTICE_EMAIL_INPUT_INVALID"),
    message: Schema.String,
  }
) {}

/** Expected failure while rendering a notice email. */
export class NoticeEmailRenderError extends Schema.TaggedError<NoticeEmailRenderError>()(
  "NoticeEmailRenderError",
  {
    code: Schema.Literal("NOTICE_EMAIL_RENDER_FAILED"),
    message: Schema.String,
  }
) {}
