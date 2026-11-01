import { Schema } from "effect";

/** Expected invalid input at the digest email boundary. */
export class DigestEmailInputError extends Schema.TaggedError<DigestEmailInputError>()(
  "DigestEmailInputError",
  {
    code: Schema.Literal("DIGEST_EMAIL_INPUT_INVALID"),
    message: Schema.String,
  }
) {}

/** Expected failure while rendering a digest email. */
export class DigestEmailRenderError extends Schema.TaggedError<DigestEmailRenderError>()(
  "DigestEmailRenderError",
  {
    code: Schema.Literal("DIGEST_EMAIL_RENDER_FAILED"),
    message: Schema.String,
  }
) {}
