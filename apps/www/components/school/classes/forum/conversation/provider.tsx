"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useConversationModel } from "@/components/school/classes/forum/conversation/hooks/intent/use-model";
import type {
  ConversationTranscriptCommand,
  ConversationTranscriptCommandResult,
  Forum,
  VirtualItem,
} from "@/components/school/classes/forum/conversation/types";
import type { ForumConversationMode } from "@/components/school/classes/forum/conversation/utils/view";
import type { ForumConversationView } from "@/lib/store/forum";

type ConversationOlderLoadResult = "committed" | "noop" | "prefetched";

export interface ConversationState {
  canGoBack: boolean;
  canPrefetchOlderPosts: boolean;
  command: ConversationTranscriptCommand | null;
  forum: Forum | undefined;
  hasBufferedOlderPosts: boolean;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  hasPendingLatestPosts: boolean;
  highlightedPostId: Id<"schoolClassForumPosts"> | null;
  isAtBottom: boolean;
  isAtLatestEdge: boolean;
  isInitialLoading: boolean;
  isLoadingNewer: boolean;
  isLoadingOlder: boolean;
  items: VirtualItem[];
  lastPostId: Id<"schoolClassForumPosts"> | undefined;
  latestConversationView: ForumConversationView | null;
  mode: ForumConversationMode;
  pendingHighlightPostId: Id<"schoolClassForumPosts"> | null;
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
  timelineSessionVersion: number;
  transcriptVariant: "focused" | "live";
  unreadPostId: Id<"schoolClassForumPosts"> | null;
}

export interface ConversationActions {
  acknowledgeUnreadCue: () => void;
  cancelPendingMarkRead: () => void;
  flushMarkRead: (
    lastReadPostId: Id<"schoolClassForumPosts"> | undefined
  ) => void;
  goBack: () => void;
  handleBottomStateChange: (nextIsAtBottom: boolean) => void;
  handleCommandResult: (result: ConversationTranscriptCommandResult) => void;
  handleHighlightVisiblePost: (postId: Id<"schoolClassForumPosts">) => void;
  handleSettledView: (view: ForumConversationView) => void;
  jumpToPostId: (postId: Id<"schoolClassForumPosts">) => void;
  loadNewerPosts: () => void;
  loadOlderPosts: () => ConversationOlderLoadResult;
  scheduleMarkRead: (
    lastReadPostId: Id<"schoolClassForumPosts"> | undefined
  ) => void;
  scrollToLatest: () => void;
}

export interface ConversationMeta {
  currentUserId: Id<"users">;
  forumId: Id<"schoolClassForums">;
}

export interface ConversationValue {
  actions: ConversationActions;
  meta: ConversationMeta;
  state: ConversationState;
}

const ConversationContext = createContext<ConversationValue | undefined>(
  undefined
);

/** Provides one forum conversation model as dependency-injected state, actions, and meta. */
export function ConversationProvider({
  children,
  currentUserId,
  forum,
  forumId,
}: {
  children: ReactNode;
  currentUserId: Id<"users">;
  forum: Forum | undefined;
  forumId: Id<"schoolClassForums">;
}) {
  const model = useConversationModel({
    forum,
    forumId,
  });

  const state = useMemo<ConversationState>(
    () => ({
      canGoBack: model.canGoBack,
      canPrefetchOlderPosts: model.canPrefetchOlderPosts,
      command: model.command,
      forum,
      hasBufferedOlderPosts: model.hasBufferedOlderPosts,
      hasMoreAfter: model.hasMoreAfter,
      hasMoreBefore: model.hasMoreBefore,
      hasPendingLatestPosts: model.hasPendingLatestPosts,
      highlightedPostId: model.highlightedPostId,
      isAtBottom: model.isAtBottom,
      isAtLatestEdge: model.isAtLatestEdge,
      isInitialLoading: model.isInitialLoading,
      isLoadingNewer: model.isLoadingNewer,
      isLoadingOlder: model.isLoadingOlder,
      items: model.items,
      lastPostId: model.lastPostId,
      latestConversationView: model.latestConversationView,
      mode: model.mode,
      pendingHighlightPostId: model.pendingHighlightPostId,
      postIdToIndex: model.postIdToIndex,
      timelineSessionVersion: model.timelineSessionVersion,
      transcriptVariant: model.transcriptVariant,
      unreadPostId: model.unreadPostId,
    }),
    [
      forum,
      model.canGoBack,
      model.canPrefetchOlderPosts,
      model.command,
      model.hasBufferedOlderPosts,
      model.hasMoreAfter,
      model.hasMoreBefore,
      model.hasPendingLatestPosts,
      model.highlightedPostId,
      model.isAtBottom,
      model.isAtLatestEdge,
      model.isInitialLoading,
      model.isLoadingNewer,
      model.isLoadingOlder,
      model.items,
      model.lastPostId,
      model.latestConversationView,
      model.mode,
      model.pendingHighlightPostId,
      model.postIdToIndex,
      model.timelineSessionVersion,
      model.transcriptVariant,
      model.unreadPostId,
    ]
  );

  const actions = useMemo<ConversationActions>(
    () => ({
      acknowledgeUnreadCue: model.acknowledgeUnreadCue,
      cancelPendingMarkRead: model.cancelPendingMarkRead,
      flushMarkRead: model.flushMarkRead,
      goBack: model.goBack,
      handleBottomStateChange: model.handleBottomStateChange,
      handleCommandResult: model.handleCommandResult,
      handleHighlightVisiblePost: model.handleHighlightVisiblePost,
      handleSettledView: model.handleSettledView,
      jumpToPostId: model.jumpToPostId,
      loadNewerPosts: model.loadNewerPosts,
      loadOlderPosts: model.loadOlderPosts,
      scheduleMarkRead: model.scheduleMarkRead,
      scrollToLatest: model.scrollToLatest,
    }),
    [
      model.acknowledgeUnreadCue,
      model.cancelPendingMarkRead,
      model.flushMarkRead,
      model.goBack,
      model.handleBottomStateChange,
      model.handleCommandResult,
      model.handleHighlightVisiblePost,
      model.handleSettledView,
      model.jumpToPostId,
      model.loadNewerPosts,
      model.loadOlderPosts,
      model.scheduleMarkRead,
      model.scrollToLatest,
    ]
  );

  const meta = useMemo<ConversationMeta>(
    () => ({
      currentUserId,
      forumId,
    }),
    [currentUserId, forumId]
  );

  const value = useMemo(
    () => ({
      actions,
      meta,
      state,
    }),
    [actions, meta, state]
  );

  return (
    <ConversationContextProvider value={value}>
      {children}
    </ConversationContextProvider>
  );
}

/** Provides one fully built conversation value for feature-local fixtures and tests. */
export function ConversationContextProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: ConversationValue;
}) {
  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}

/** Reads one selected value from the active forum conversation provider. */
export function useConversation<T>(
  selector: (value: ConversationValue) => T
): T {
  const value = useContextSelector(ConversationContext, (context) => context);

  if (!value) {
    throw new Error(
      "useConversation must be used within a ConversationProvider"
    );
  }

  return selector(value);
}
