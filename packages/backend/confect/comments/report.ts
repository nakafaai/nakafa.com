import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** Why a learner reports another learner's comment. */
export const ReportReason = Schema.Literals([
  "spam",
  "harassment",
  "misleading",
  "other",
]);

/** One learner's report of one comment, which stays until the comment or the learner's account is deleted. */
export const CommentReport = Schema.Struct({
  commentId: Id("comments"),
  createdAt: Schema.Finite,
  reason: ReportReason,
  userId: Id("users"),
});
