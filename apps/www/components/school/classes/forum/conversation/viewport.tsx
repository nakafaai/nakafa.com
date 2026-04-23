"use client";

import { memo } from "react";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";
import { ForumConversationTranscript } from "@/components/school/classes/forum/conversation/transcript";

/** Renders the live transcript viewport with one simple latest button. */
export const ForumConversationViewport = memo(() => {
  const forum = useData((state) => state.forum);

  if (!forum) {
    return null;
  }

  return <ForumConversationTranscript />;
});
ForumConversationViewport.displayName = "ForumConversationViewport";
