"use client";

import {
  useForumSession,
  useForumSessionStoreApi,
} from "@/components/school/classes/forum/context/use-session";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";
import { useTranscriptData } from "@/components/school/classes/forum/conversation/hooks/transcript/use-data";
import { ForumPostInput } from "@/components/school/classes/forum/conversation/input";
import { ForumConversationTranscript } from "@/components/school/classes/forum/conversation/transcript";
import { ConversationViewportProvider } from "@/components/school/classes/forum/conversation/viewport/context";

/** Loads and wires one Forum Conversation body into the viewport service. */
export function ForumConversationBody() {
  const forumId = useData((state) => state.forumId);
  const isHydrated = useForumSession((state) => state.isHydrated);
  const forumSessionStore = useForumSessionStoreApi();
  const savedScrollSnapshot =
    forumSessionStore.getState().conversationScrollSnapshotByForumId[forumId] ??
    null;
  const {
    acknowledgeUnreadCue,
    activeTranscript,
    error,
    forum,
    isError,
    isPending,
    unreadCue,
  } = useTranscriptData({
    forumId,
  });

  if (!isHydrated) {
    return null;
  }

  if (isError) {
    throw error;
  }

  if (isPending || !forum) {
    return null;
  }

  return (
    <ConversationViewportProvider
      acknowledgeUnreadCue={acknowledgeUnreadCue}
      activeTranscript={activeTranscript}
      forumId={forumId}
      savedSnapshot={savedScrollSnapshot}
      unreadCue={unreadCue}
    >
      <div className="flex size-full flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <ForumConversationTranscript
            activeTranscript={activeTranscript}
            forum={forum}
          />
        </div>
        <ForumPostInput />
      </div>
    </ConversationViewportProvider>
  );
}
