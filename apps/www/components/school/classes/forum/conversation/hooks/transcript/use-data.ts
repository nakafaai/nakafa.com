import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";
import { createActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import { useUnreadCue } from "@/components/school/classes/forum/conversation/hooks/unread/use-cue";

/** Loads one forum transcript and derives the render model used by the viewport. */
export function useTranscriptData({
  forumId,
}: {
  forumId: Id<"schoolClassForums">;
}) {
  const forum = useData((state) => state.forum);
  const {
    data: posts,
    error,
    isError,
    isPending,
  } = useQueryWithStatus(api.classes.forums.queries.pages.getForumPosts, {
    forumId,
  });

  const transcriptPosts = posts ?? [];
  const { acknowledgeUnreadCue, unreadCue } = useUnreadCue({
    isPending,
    posts: transcriptPosts,
  });
  const activeTranscript = createActiveTranscriptModel({
    forum,
    posts: transcriptPosts,
    unreadCue,
  });

  return {
    acknowledgeUnreadCue,
    activeTranscript,
    error,
    forum,
    isError,
    isPending,
    unreadCue,
  };
}
