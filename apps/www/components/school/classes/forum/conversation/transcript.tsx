"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Virtualizer } from "virtua";
import {
  useForumSession,
  useForumSessionStoreApi,
} from "@/components/school/classes/forum/context/use-session";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";
import { getConversationRowKey } from "@/components/school/classes/forum/conversation/data/pages";
import { useHydratedTranscriptController } from "@/components/school/classes/forum/conversation/hooks/use-hydrated-transcript-controller";
import { JumpBar } from "@/components/school/classes/forum/conversation/jump-bar";
import { VirtualTranscriptRow } from "@/components/school/classes/forum/conversation/transcript-row";
import type { ConversationScrollSnapshot } from "@/components/school/classes/forum/store/session";

/**
 * Virtua transcript backed by one reactive Convex query.
 *
 * References:
 * - Convex best practices:
 *   https://docs.convex.dev/understanding/best-practices/
 * - Convex collect/query pattern:
 *   https://stack.convex.dev/fully-reactive-pagination
 * - React effect guidance:
 *   https://react.dev/learn/you-might-not-need-an-effect
 * - virtua advanced chat story:
 *   https://github.com/inokawa/virtua/blob/main/stories/react/advanced/Chat.stories.tsx
 */
export const ForumConversationTranscript = () => {
  const forumId = useData((state) => state.forumId);
  const isHydrated = useForumSession((state) => state.isHydrated);
  const forumSessionStore = useForumSessionStoreApi();

  const savedScrollSnapshot =
    forumSessionStore.getState().conversationScrollSnapshotByForumId[forumId] ??
    null;

  if (!isHydrated) {
    return null;
  }

  return (
    <HydratedTranscript
      forumId={forumId}
      initialSavedScrollSnapshot={savedScrollSnapshot}
      key={forumId}
    />
  );
};
ForumConversationTranscript.displayName = "ForumConversationTranscript";

/** Renders the stateful virtual transcript for one hydrated forum session. */
function HydratedTranscript({
  forumId,
  initialSavedScrollSnapshot,
}: {
  forumId: Id<"schoolClassForums">;
  initialSavedScrollSnapshot: ConversationScrollSnapshot | null;
}) {
  const {
    activeTranscript,
    canGoBack,
    error,
    forum,
    goBack,
    goToLatest,
    handleScroll,
    initialRestorableCache,
    isError,
    isPending,
    setVirtualizerHandle,
    shouldShowJumpBar,
  } = useHydratedTranscriptController({
    forumId,
    initialSavedScrollSnapshot,
  });

  if (isError) {
    throw error;
  }

  if (isPending) {
    return null;
  }

  return (
    <>
      <div
        className="absolute inset-0 flex flex-col overflow-y-auto overscroll-contain"
        style={{ overflowAnchor: "none" }}
      >
        <Virtualizer
          cache={initialRestorableCache ?? undefined}
          data={activeTranscript.rows}
          onScroll={handleScroll}
          ref={setVirtualizerHandle}
        >
          {(row, index) => (
            <VirtualTranscriptRow
              index={index}
              key={getConversationRowKey(row, forum?._id)}
              row={row}
              rows={activeTranscript.rows}
            />
          )}
        </Virtualizer>
      </div>

      <JumpBar
        canGoBack={canGoBack}
        onBack={goBack}
        onLatest={goToLatest}
        visible={shouldShowJumpBar}
      />
    </>
  );
}
