import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";
import { createActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/active-transcript";
import { useUnreadCue } from "@/components/school/classes/forum/conversation/hooks/use-unread-cue";
import type { ConversationScrollSnapshot } from "@/components/school/classes/forum/store/session";
import { canRestoreConversationScrollCache } from "@/components/school/classes/forum/store/session";

/** Loads one forum transcript and derives the render model used by the viewport. */
export function useTranscriptData({
  forumId,
  initialSavedScrollSnapshot,
}: {
  forumId: Id<"schoolClassForums">;
  initialSavedScrollSnapshot: ConversationScrollSnapshot | null;
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
  const canRestoreInitialCache = canRestoreConversationScrollCache({
    lastPostId: activeTranscript.lastPostId,
    renderedRowCount: activeTranscript.rows.length,
    snapshot: initialSavedScrollSnapshot,
  });
  const initialRestorableCache = canRestoreInitialCache
    ? (initialSavedScrollSnapshot?.cache ?? null)
    : null;

  return {
    acknowledgeUnreadCue,
    activeTranscript,
    error,
    forum,
    initialRestorableCache,
    isError,
    isPending,
    unreadCue,
  };
}
