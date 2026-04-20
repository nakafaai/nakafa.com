import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useConvex } from "convex/react";
import { useCallback, useRef } from "react";
import {
  createFocusedTimelineState,
  createFocusedWindowArgs,
} from "@/components/school/classes/forum/conversation/utils/focused";
import type { ConversationTimeline } from "@/components/school/classes/forum/conversation/utils/timeline";
import type { ForumConversationMode } from "@/components/school/classes/forum/conversation/utils/view";

/** Owns cancellable around-query requests that swap the transcript into a focused window. */
export function useConversationJumpRequest({
  forumId,
  replaceWithFocusedTimeline,
  setMode,
}: {
  forumId: Id<"schoolClassForums">;
  replaceWithFocusedTimeline: (timeline: ConversationTimeline) => void;
  setMode: (mode: ForumConversationMode) => void;
}) {
  const convex = useConvex();
  const jumpRequestIdRef = useRef(0);

  const cancelPendingJumpRequest = useCallback(() => {
    jumpRequestIdRef.current += 1;
  }, []);

  const requestFocusedTimeline = useCallback(
    async ({
      nextMode,
      onRejected,
      postId,
    }: {
      nextMode: Extract<ForumConversationMode, { kind: "jump" | "restore" }>;
      onRejected: () => void;
      postId: Id<"schoolClassForumPosts">;
    }) => {
      const requestId = jumpRequestIdRef.current + 1;

      jumpRequestIdRef.current = requestId;
      setMode(nextMode);

      try {
        const aroundResult = await convex.query(
          api.classes.forums.queries.around.getForumPostsAround,
          createFocusedWindowArgs({
            forumId,
            targetPostId: postId,
          })
        );

        if (jumpRequestIdRef.current !== requestId) {
          return;
        }

        replaceWithFocusedTimeline(
          createFocusedTimelineState({
            aroundResult,
            targetKind: nextMode.kind,
          })
        );
      } catch {
        if (jumpRequestIdRef.current !== requestId) {
          return;
        }

        onRejected();
      }
    },
    [convex, forumId, replaceWithFocusedTimeline, setMode]
  );

  return {
    cancelPendingJumpRequest,
    requestFocusedTimeline,
  };
}
