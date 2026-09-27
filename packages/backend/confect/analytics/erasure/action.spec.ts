import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
export const postHogErasureConfigErrorCode = "POSTHOG_ERASURE_CONFIG_INVALID";
export const postHogErasureRequestErrorCode = "POSTHOG_ERASURE_REQUEST_FAILED";
/** Raised when PostHog erasure credentials are not configured. */
export class PostHogErasureConfigError extends Schema.TaggedError<PostHogErasureConfigError>()(
  "PostHogErasureConfigError",
  {
    code: Schema.Literal(postHogErasureConfigErrorCode),
    message: Schema.String,
  }
) {}

/** Raised when PostHog does not accept the complete erasure request. */

export class PostHogErasureRequestError extends Schema.TaggedError<PostHogErasureRequestError>()(
  "PostHogErasureRequestError",
  {
    code: Schema.Literal(postHogErasureRequestErrorCode),
    message: Schema.String,
  }
) {}

export default GroupSpec.make().addFunction(
  FunctionSpec.internalAction({
    name: "eraseUserAnalytics",
    args: () => ({
      userId: IdSchema("users"),
    }),
    returns: () => Schema.Null,
    error: () =>
      Schema.Union([PostHogErasureConfigError, PostHogErasureRequestError]),
  })
);
