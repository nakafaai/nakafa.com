import { type ComponentProps, memo } from "react";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";
import type { ConversationRow } from "@/components/school/classes/forum/conversation/data/pages";
import { ForumHeader } from "@/components/school/classes/forum/conversation/header";
import { ForumPostItem } from "@/components/school/classes/forum/conversation/item";
import { ConversationDateSeparator } from "@/components/school/classes/forum/conversation/seperators/date";
import { ConversationUnreadSeparator } from "@/components/school/classes/forum/conversation/seperators/unread";

/** Render one transcript row while keeping author grouping logic in one place. */
export const TranscriptRow = memo(
  ({
    row,
    previousRow,
    nextRow,
    itemRef,
  }: {
    row: ConversationRow;
    previousRow?: ConversationRow;
    nextRow?: ConversationRow;
    itemRef?: ComponentProps<"div">["ref"];
  }) => {
    const forum = useData((state) => state.forum);

    if (row.type === "header") {
      return forum ? <ForumHeader /> : null;
    }

    if (row.type === "date") {
      return <ConversationDateSeparator value={row.value} />;
    }

    if (row.type === "unread") {
      return (
        <ConversationUnreadSeparator count={row.count} status={row.status} />
      );
    }

    const previousPost = previousRow?.type === "post" ? previousRow.post : null;
    const nextPost = nextRow?.type === "post" ? nextRow.post : null;
    const isFirstInGroup =
      !previousPost || previousPost.createdBy !== row.post.createdBy;
    const isLastInGroup =
      !nextPost || nextPost.createdBy !== row.post.createdBy;

    return (
      <ForumPostItem
        isFirstInGroup={isFirstInGroup}
        isLastInGroup={isLastInGroup}
        itemRef={itemRef}
        post={row.post}
      />
    );
  }
);
TranscriptRow.displayName = "TranscriptRow";
