import { Schema } from "effect";

/** Expected invalid input at the try-out reminder email boundary. */
export class ReminderEmailInputError extends Schema.TaggedError<
  ReminderEmailInputError,
  { readonly brand: unique symbol }
>()("ReminderEmailInputError", {
  code: Schema.Literal("REMINDER_EMAIL_INPUT_INVALID"),
  message: Schema.String,
}) {}

/** Expected failure while rendering a try-out reminder email. */
export class ReminderEmailRenderError extends Schema.TaggedError<
  ReminderEmailRenderError,
  { readonly brand: unique symbol }
>()("ReminderEmailRenderError", {
  code: Schema.Literal("REMINDER_EMAIL_RENDER_FAILED"),
  message: Schema.String,
}) {}
