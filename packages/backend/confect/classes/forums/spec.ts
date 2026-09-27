import { Schema } from "effect";

/** Expected forum validation, access, and transcript failures. */
export class ForumError extends Schema.TaggedError<ForumError>()("ForumError", {
  code: Schema.Literals([
    "FORUM_MENTION_LIMIT_EXCEEDED",
    "INVALID_FORUM_MENTION",
    "FORUM_REACTION_INVALID",
    "FORUM_NOT_FOUND",
    "FORUM_LOCKED",
    "FORUM_TITLE_TOO_SHORT",
    "FORUM_BODY_TOO_SHORT",
    "FORUM_TAG_ACCESS_DENIED",
    "EMPTY_POST",
    "PARENT_POST_NOT_FOUND",
    "POST_NOT_FOUND",
    "FORUM_REACTION_VARIANT_LIMIT_EXCEEDED",
  ]),
  message: Schema.String,
}) {}
export const FORUM_CLEANUP_FAILED_CODE = "FORUM_CLEANUP_FAILED";

/** A bounded cleanup transaction could not safely complete. */
export class ForumCleanupError extends Schema.TaggedError<ForumCleanupError>()(
  "ForumCleanupError",
  {
    code: Schema.Literal(FORUM_CLEANUP_FAILED_CODE),
    message: Schema.String,
  }
) {}
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
