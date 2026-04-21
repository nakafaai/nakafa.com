import { ArrowTurnForwardIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Activity, memo } from "react";
import type { ForumPost } from "@/components/school/classes/forum/conversation/models";
import { useConversation } from "@/components/school/classes/forum/conversation/provider";

/**
 * Links one reply preview back to its parent post, loading jump mode when the
 * parent is outside the current window.
 */
export const PostReplyIndicator = memo(({ post }: { post: ForumPost }) => {
  const jumpToPostId = useConversation((state) => state.jumpToPostId);
  const { parentId, replyToBody, replyToUser } = post;

  if (!(parentId && replyToUser)) {
    return null;
  }

  return (
    <button
      className="flex min-w-0 cursor-pointer items-center gap-1 text-left text-muted-foreground text-xs transition-colors ease-out hover:text-foreground"
      data-testid={`conversation-reply-indicator-${post._id}`}
      onClick={(event) => {
        event.preventDefault();
        jumpToPostId(parentId);
      }}
      type="button"
    >
      <HugeIcons className="size-3 shrink-0" icon={ArrowTurnForwardIcon} />
      <span className="max-w-32 shrink-0 truncate text-primary">
        {replyToUser.name}
      </span>
      <Activity mode={replyToBody ? "visible" : "hidden"}>
        <span className="min-w-0 flex-1 truncate">{replyToBody}</span>
      </Activity>
    </button>
  );
});
PostReplyIndicator.displayName = "PostReplyIndicator";
