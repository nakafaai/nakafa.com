import { QueryResult, useQuery } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useData } from "@/components/school/classes/forum/conversation/context";
import { createActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import { useUnreadCue } from "@/components/school/classes/forum/conversation/transcript/cue";

/** Loads one forum transcript and derives the render model used by the viewport. */
export function useTranscriptData({
  forumId,
}: {
  forumId: Id<"schoolClassForums">;
}) {
  const forum = useData((state) => state.forum);
  const query = useQuery(
    refs.public.classes.forums.queries.pages.getForumPosts,
    {
      forumId,
    }
  );

  const transcriptPosts = QueryResult.isSuccess(query) ? query.value : [];
  const isPending = QueryResult.isLoading(query);
  const isError = QueryResult.isFailure(query);
  const error = isError ? query.error : undefined;
  const { acknowledgeUnreadCue, unreadCue } = useUnreadCue({
    forumId,
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
