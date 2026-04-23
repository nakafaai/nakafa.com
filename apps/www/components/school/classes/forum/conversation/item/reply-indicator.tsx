import { ArrowTurnForwardIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Activity, memo } from "react";
import { useControls } from "@/components/school/classes/forum/conversation/context/use-controls";
import type { ForumPost } from "@/components/school/classes/forum/conversation/data/entities";

/** Renders one lightweight reply preview that can jump to the replied message. */
export const PostReplyIndicator = memo(({ post }: { post: ForumPost }) => {
  const { parentId, replyToBody, replyToUser } = post;
  const { goToPost } = useControls();

  if (!(parentId && replyToUser)) {
    return null;
  }

  return (
    <button
      className="flex min-w-0 cursor-pointer items-center gap-1 text-left text-muted-foreground text-xs transition-colors hover:text-foreground"
      onClick={() => goToPost(parentId)}
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
