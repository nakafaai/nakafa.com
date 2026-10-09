import { Schema } from "effect";

/** Expected invalid input at the account-ready email boundary. */
export class AccountReadyEmailInputError extends Schema.TaggedError<AccountReadyEmailInputError>()(
  "AccountReadyEmailInputError",
  {
    code: Schema.Literal("ACCOUNT_READY_EMAIL_INPUT_INVALID"),
    message: Schema.String,
  }
) {}

/** Expected failure while rendering an account-ready email. */
export class AccountReadyEmailRenderError extends Schema.TaggedError<AccountReadyEmailRenderError>()(
  "AccountReadyEmailRenderError",
  {
    code: Schema.Literal("ACCOUNT_READY_EMAIL_RENDER_FAILED"),
    message: Schema.String,
  }
) {}
