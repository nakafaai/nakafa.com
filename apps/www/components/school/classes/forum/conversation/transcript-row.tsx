import { memo } from "react";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";
import type { ConversationRow } from "@/components/school/classes/forum/conversation/data/pages";
import { ConversationDateSeparator } from "@/components/school/classes/forum/conversation/date-separator";
import { ForumHeader } from "@/components/school/classes/forum/conversation/header";
import { ForumPostItem } from "@/components/school/classes/forum/conversation/item";

/** Render one Virtua row while keeping author grouping logic in one place. */
export const TranscriptRow = memo(function TranscriptRow({
  row,
  previousRow,
  nextRow,
}: {
  row: ConversationRow;
  previousRow?: ConversationRow;
  nextRow?: ConversationRow;
}) {
  const forum = useData((state) => state.forum);

  if (row.type === "header") {
    return forum ? <ForumHeader /> : null;
  }

  if (row.type === "date") {
    return <ConversationDateSeparator value={row.value} />;
  }

  const previousPost = previousRow?.type === "post" ? previousRow.post : null;
  const nextPost = nextRow?.type === "post" ? nextRow.post : null;
  const isFirstInGroup =
    !previousPost || previousPost.createdBy !== row.post.createdBy;
  const showContinuationTime =
    !nextPost || nextPost.createdBy !== row.post.createdBy;

  return (
    <ForumPostItem
      isFirstInGroup={isFirstInGroup}
      post={row.post}
      showContinuationTime={showContinuationTime}
    />
  );
});
