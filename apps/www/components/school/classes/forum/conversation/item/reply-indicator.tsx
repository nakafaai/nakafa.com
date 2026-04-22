import { ArrowTurnForwardIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Activity, memo } from "react";
import type { ForumPost } from "@/components/school/classes/forum/conversation/data/entities";

/** Renders one lightweight reply preview without transcript jump orchestration. */
export const PostReplyIndicator = memo(({ post }: { post: ForumPost }) => {
  const { parentId, replyToBody, replyToUser } = post;

  if (!(parentId && replyToUser)) {
    return null;
  }

  return (
    <div className="flex min-w-0 items-center gap-1 text-muted-foreground text-xs">
      <HugeIcons className="size-3 shrink-0" icon={ArrowTurnForwardIcon} />
      <span className="max-w-32 shrink-0 truncate text-primary">
        {replyToUser.name}
      </span>
      <Activity mode={replyToBody ? "visible" : "hidden"}>
        <span className="min-w-0 flex-1 truncate">{replyToBody}</span>
      </Activity>
    </div>
  );
});
PostReplyIndicator.displayName = "PostReplyIndicator";
