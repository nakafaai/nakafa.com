import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { getUserMap } from "@repo/backend/convex/lib/helpers/user";

export function attachUsers(ctx: QueryCtx, comments: Doc<"comments">[]) {
  return getUserMap(
    ctx,
    comments.map((c) => c.userId)
  );
}

export function attachReplyToUsers(ctx: QueryCtx, comments: Doc<"comments">[]) {
  const replyToUserIds = comments
    .map((c) => c.replyToUserId)
    .filter((id) => id !== undefined);

  return getUserMap(ctx, replyToUserIds);
}
