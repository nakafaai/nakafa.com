import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  useCallback,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useConversationBackStack } from "@/components/school/classes/forum/conversation/hooks/intent/use-back-stack";
import { useConversationHighlight } from "@/components/school/classes/forum/conversation/hooks/intent/use-highlight";
import { useConversationJumpRequest } from "@/components/school/classes/forum/conversation/hooks/intent/use-jump-request";
import type {
  ConversationTranscriptCommand,
  ConversationTranscriptCommandResult,
} from "@/components/school/classes/forum/conversation/types";
import type { ConversationTimeline } from "@/components/school/classes/forum/conversation/utils/timeline";
import type { ForumConversationMode } from "@/components/school/classes/forum/conversation/utils/view";
import type { ForumConversationView } from "@/lib/store/forum";

/** Owns navigation intent, jump history, and transient highlight state. */
export function useConversationNavigation({
  forumId,
  isAtLatestEdge,
  postIdToIndex,
  saveConversationView,
  savedConversationView,
  setMode,
  shouldAnimateNavigation,
  showLatestPosts,
  transcriptVariant,
  replaceWithFocusedTimeline,
}: {
  forumId: Id<"schoolClassForums">;
  isAtLatestEdge: boolean;
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
  replaceWithFocusedTimeline: (timeline: ConversationTimeline) => void;
  saveConversationView: (
    forumId: Id<"schoolClassForums">,
    view: ForumConversationView
  ) => void;
  savedConversationView: ForumConversationView | null;
  setMode: (mode: ForumConversationMode) => void;
  shouldAnimateNavigation: boolean;
  showLatestPosts: () => boolean;
  transcriptVariant: "focused" | "live";
}) {
  const [command, setCommand] = useState<ConversationTranscriptCommand | null>(
    null
  );
  const commandRef = useRef<ConversationTranscriptCommand | null>(command);
  const commandIdRef = useRef(0);
  const latestConversationViewRef = useRef<ForumConversationView | null>(
    savedConversationView
  );
  const {
    canGoBack,
    clearJumpHistory,
    pruneReachedBackHistory,
    pushCurrentViewToBackStack,
    takeBackView,
  } = useConversationBackStack({
    postIdToIndex,
  });
  const {
    clearJumpHighlight,
    handleHighlightVisiblePost,
    highlightedPostId,
    pendingHighlightPostId,
    queueJumpHighlight,
  } = useConversationHighlight();
  const { cancelPendingJumpRequest, requestFocusedTimeline } =
    useConversationJumpRequest({
      forumId,
      replaceWithFocusedTimeline,
      setMode,
    });

  commandRef.current = command;

  useLayoutEffect(() => {
    latestConversationViewRef.current = savedConversationView;
  }, [savedConversationView]);

  const createCommandId = useCallback(() => {
    commandIdRef.current += 1;
    return commandIdRef.current;
  }, []);

  const persistConversationView = useCallback(
    (view?: ForumConversationView | null) => {
      const nextView = view ?? latestConversationViewRef.current;

      if (!nextView) {
        return;
      }

      latestConversationViewRef.current = nextView;
      saveConversationView(forumId, nextView);
    },
    [forumId, saveConversationView]
  );

  const showLatestEdge = useCallback(() => {
    cancelPendingJumpRequest();
    clearJumpHighlight();
    setCommand({
      id: createCommandId(),
      kind: "latest",
      smooth: shouldAnimateNavigation,
    });

    if (transcriptVariant === "live" && isAtLatestEdge) {
      return;
    }

    if (showLatestPosts()) {
      setMode({ kind: "live" });
    }
  }, [
    cancelPendingJumpRequest,
    clearJumpHighlight,
    createCommandId,
    isAtLatestEdge,
    setMode,
    shouldAnimateNavigation,
    showLatestPosts,
    transcriptVariant,
  ]);

  const jumpToPostId = useCallback(
    (postId: Id<"schoolClassForumPosts">) => {
      pushCurrentViewToBackStack(latestConversationViewRef.current);
      cancelPendingJumpRequest();
      clearJumpHighlight();
      persistConversationView({
        kind: "post",
        offset: 0,
        postId,
      });
      queueJumpHighlight(postId);
      setCommand({
        id: createCommandId(),
        kind: "jump",
        postId,
        smooth: shouldAnimateNavigation,
      });
    },
    [
      cancelPendingJumpRequest,
      clearJumpHighlight,
      createCommandId,
      persistConversationView,
      pushCurrentViewToBackStack,
      queueJumpHighlight,
      shouldAnimateNavigation,
    ]
  );

  const scrollToLatest = useCallback(() => {
    clearJumpHistory();
    showLatestEdge();
  }, [clearJumpHistory, showLatestEdge]);

  const goBack = useCallback(() => {
    const view = takeBackView();

    if (!view) {
      return;
    }

    if (view.kind === "bottom") {
      showLatestEdge();
      return;
    }

    cancelPendingJumpRequest();
    clearJumpHighlight();
    persistConversationView(view);
    setCommand({
      id: createCommandId(),
      kind: "restore",
      smooth: false,
      view,
    });
  }, [
    cancelPendingJumpRequest,
    clearJumpHighlight,
    createCommandId,
    persistConversationView,
    showLatestEdge,
    takeBackView,
  ]);

  const handleCommandResult = useCallback(
    (result: ConversationTranscriptCommandResult) => {
      const activeCommand = commandRef.current;

      if (!(activeCommand && activeCommand.id === result.id)) {
        return;
      }

      setCommand(null);

      if (result.status !== "missing") {
        return;
      }

      if (activeCommand.kind === "jump") {
        requestFocusedTimeline({
          nextMode: { kind: "jump", postId: activeCommand.postId },
          onRejected: () => {
            clearJumpHighlight();
            setMode({ kind: "live" });
          },
          postId: activeCommand.postId,
        });
        return;
      }

      if (activeCommand.kind !== "restore") {
        return;
      }

      requestFocusedTimeline({
        nextMode: {
          kind: "restore",
          postId: activeCommand.view.postId,
          view: activeCommand.view,
        },
        onRejected: () => {
          persistConversationView(activeCommand.view);
        },
        postId: activeCommand.view.postId,
      });
    },
    [
      clearJumpHighlight,
      persistConversationView,
      requestFocusedTimeline,
      setMode,
    ]
  );

  const handleSettledView = useCallback(
    (view: ForumConversationView) => {
      persistConversationView(view);
      pruneReachedBackHistory(view);
    },
    [persistConversationView, pruneReachedBackHistory]
  );

  const handleNavigationUnmount = useEffectEvent(() => {
    clearJumpHistory();
    cancelPendingJumpRequest();
    clearJumpHighlight();
    setCommand(null);
  });

  useLayoutEffect(
    () => () => {
      handleNavigationUnmount();
    },
    []
  );

  return {
    canGoBack,
    command,
    goBack,
    handleCommandResult,
    handleHighlightVisiblePost,
    handleSettledView,
    highlightedPostId,
    jumpToPostId,
    latestConversationView: latestConversationViewRef.current,
    pendingHighlightPostId,
    scrollToLatest,
  };
}
