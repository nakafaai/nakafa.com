import { LearnerTextRefusal } from "@repo/backend/confect/writing/text";
import { Schema } from "effect";

/** Expected denial while writing a comment, a like, a report or a photo of one. */
export class CommentWriteError extends Schema.TaggedError<CommentWriteError>()(
  "CommentWriteError",
  {
    code: Schema.Literals([
      ...LearnerTextRefusal.literals,
      "COMMENT_PARENT_NOT_FOUND",
      "COMMENT_PARENT_MISMATCH",
      "COMMENT_NOT_FOUND",
      "COMMENT_PHOTO_REFUSED",
      "COMMENT_PHOTO_TOO_LARGE",
      "COMMENT_RATE_LIMITED",
      "COMMENT_UPLOAD_GONE",
      "FORBIDDEN",
    ]),
    message: Schema.String,
  }
) {}
