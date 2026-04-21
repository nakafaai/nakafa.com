import { useReducedMotion } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useConvex, usePaginatedQuery } from "convex/react";
import type { ReactNode } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useForum } from "@/components/school/classes/forum/conversation/context/use-forum";
import type { ForumConversationView } from "@/components/school/classes/forum/conversation/store/forum";
import {
  type ConversationRuntimeStore,
  createConversationStore,
} from "@/components/school/classes/forum/conversation/store/runtime";
import type {
  Forum,
  ForumPost,
} from "@/components/school/classes/forum/conversation/types";
import { FORUM_CONVERSATION_WINDOW } from "@/components/school/classes/forum/conversation/utils/focused";

type ConversationStoreApi = ReturnType<typeof createConversationStore>;

const ConversationContext = createContext<ConversationStoreApi | null>(null);

/** Provides one forum-scoped conversation runtime store and syncs external data into it. */
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
  const convex = useConvex();
  const prefersReducedMotion = useReducedMotion();
  const isForumHydrated = useForum((state) => state.isHydrated);
  const saveConversationView = useForum((state) => state.saveConversationView);
  const savedConversationView = useForum(
    (state) => state.savedConversationViews[forumId] ?? null
  );
  const {
    loadMore,
    results: liveResults,
    status: liveStatus,
  } = usePaginatedQuery(
    api.classes.forums.queries.feed.getForumPosts,
    { forumId },
    { initialNumItems: 25 }
  );
  const livePosts = useMemo(() => [...liveResults].reverse(), [liveResults]);
  const liveHasMoreBefore =
    liveStatus === "CanLoadMore" || liveStatus === "LoadingMore";
  const depsRef = useRef({
    fetchAround: async (
      postId: Id<"schoolClassForumPosts">
    ): Promise<{
      hasMoreAfter: boolean;
      hasMoreBefore: boolean;
      newestPostId: Id<"schoolClassForumPosts"> | null;
      oldestPostId: Id<"schoolClassForumPosts"> | null;
      posts: ForumPost[];
    }> =>
      convex.query(api.classes.forums.queries.around.getForumPostsAround, {
        forumId,
        limit: FORUM_CONVERSATION_WINDOW,
        targetPostId: postId,
      }),
    fetchNewer: async (postId: Id<"schoolClassForumPosts">) =>
      convex.query(api.classes.forums.queries.newer.getForumPostsNewer, {
        afterPostId: postId,
        forumId,
        limit: FORUM_CONVERSATION_WINDOW,
      }),
    fetchOlder: async (postId: Id<"schoolClassForumPosts">) =>
      convex.query(api.classes.forums.queries.older.getForumPostsOlder, {
        beforePostId: postId,
        forumId,
        limit: FORUM_CONVERSATION_WINDOW,
      }),
    loadLiveOlder: () => {
      if (liveStatus !== "CanLoadMore") {
        return;
      }

      loadMore(FORUM_CONVERSATION_WINDOW);
    },
    saveConversationView: (view: ForumConversationView) =>
      saveConversationView(forumId, view),
  });

  depsRef.current = {
    fetchAround: async (postId) =>
      convex.query(api.classes.forums.queries.around.getForumPostsAround, {
        forumId,
        limit: FORUM_CONVERSATION_WINDOW,
        targetPostId: postId,
      }),
    fetchNewer: async (postId) =>
      convex.query(api.classes.forums.queries.newer.getForumPostsNewer, {
        afterPostId: postId,
        forumId,
        limit: FORUM_CONVERSATION_WINDOW,
      }),
    fetchOlder: async (postId) =>
      convex.query(api.classes.forums.queries.older.getForumPostsOlder, {
        beforePostId: postId,
        forumId,
        limit: FORUM_CONVERSATION_WINDOW,
      }),
    loadLiveOlder: () => {
      if (liveStatus !== "CanLoadMore") {
        return;
      }

      loadMore(FORUM_CONVERSATION_WINDOW);
    },
    saveConversationView: (view) => saveConversationView(forumId, view),
  };

  const [store] = useState(() =>
    createConversationStore({
      currentUserId,
      forumId,
      getDeps: () => depsRef.current,
      prefersReducedMotion,
    })
  );

  useLayoutEffect(() => {
    store.getState().syncForum(forum);
  }, [forum, store]);

  useLayoutEffect(() => {
    store.getState().syncForumStore({
      isHydrated: isForumHydrated,
      savedConversationView,
    });
  }, [isForumHydrated, savedConversationView, store]);

  useLayoutEffect(() => {
    store.getState().syncLiveWindow({
      hasMoreBefore: liveHasMoreBefore,
      posts: livePosts,
    });
  }, [liveHasMoreBefore, livePosts, store]);

  return (
    <ConversationContext.Provider value={store}>
      {children}
    </ConversationContext.Provider>
  );
}

/** Reads one selected slice from the active conversation runtime store. */
export function useConversation<T>(
  selector: (state: ConversationRuntimeStore) => T
) {
  const store = useContextSelector(ConversationContext, (context) => context);

  if (!store) {
    throw new Error(
      "useConversation must be used within a ConversationProvider"
    );
  }

  return useStore(store, useShallow(selector));
}
