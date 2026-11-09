import { Id } from "@repo/backend/confect/_generated/id";
import { CommentPhoto } from "@repo/backend/confect/comments/photo";
import { Schema } from "effect";

/**
 * A photo a learner uploaded for the next comment and has not posted yet: the photo itself, who uploaded
 * it, and when, so a daily sweep deletes one that stays unposted. A post moves the photo onto its comment.
 */
export const CommentUpload = Schema.Struct({
  ...CommentPhoto.fields,
  createdAt: Schema.Finite,
  userId: Id("users"),
});
