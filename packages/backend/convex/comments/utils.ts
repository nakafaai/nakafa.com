import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getUserMap } from "../lib/userHelpers";

export function attachUsers(ctx: QueryCtx, comments: Doc<"comments">[]) {
  return getUserMap(
    ctx,
    comments.map((c) => c.userId)
  );
}

export function attachReplyToUsers(ctx: QueryCtx, comments: Doc<"comments">[]) {
  const replyToUserIds = comments
    .map((c) => c.replyToUserId)
    .filter((id): id is Id<"users"> => id !== undefined);

  return getUserMap(ctx, replyToUserIds);
}
