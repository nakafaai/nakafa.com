"use client";

import { useReducedMotion } from "@mantine/hooks";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import {
  type Dispatch,
  type SetStateAction,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ForumContextProvider,
  useForum,
} from "@/components/school/classes/forum/conversation/context/use-forum";
import type { ForumConversationView } from "@/components/school/classes/forum/conversation/models";
import { ConversationStoreProvider } from "@/components/school/classes/forum/conversation/provider";
import { createConversationStore } from "@/components/school/classes/forum/conversation/store/runtime";
import { FORUM_CONVERSATION_WINDOW } from "@/components/school/classes/forum/conversation/utils/focused";
import { ForumConversationViewport } from "@/components/school/classes/forum/conversation/viewport";
import {
  appendConversationPlaywrightPost,
  type ConversationPlaywrightFixture,
  type ConversationPlaywrightScenario,
  createConversationPlaywrightFixture,
  fetchFocusedWindow,
  fetchNewerWindow,
  fetchOlderWindow,
  getLiveWindowPosts,
  loadOlderLiveWindow,
} from "@/components/school/classes/forum/playwright/fixtures";
import { ConversationPlaywrightPanel } from "@/components/school/classes/forum/playwright/panel";

const convex = new ConvexReactClient("https://wild-bison-123.convex.cloud");

/** Mounts one deterministic browser harness around the real conversation runtime. */
export function ConversationPlaywrightHarness({
  scenario,
}: {
  scenario: ConversationPlaywrightScenario;
}) {
  const fixture = useMemo(
    () => createConversationPlaywrightFixture(scenario),
    [scenario]
  );

  return (
    <ConvexProvider client={convex}>
      <ForumContextProvider classId={fixture.classId}>
        <HarnessRuntime fixture={fixture} scenario={scenario} />
      </ForumContextProvider>
    </ConvexProvider>
  );
}

function HarnessRuntime({
  fixture,
  scenario,
}: {
  fixture: ConversationPlaywrightFixture;
  scenario: ConversationPlaywrightScenario;
}) {
  const prefersReducedMotion = useReducedMotion();
  const clearTransientConversationState = useForum(
    (state) => state.clearTransientConversationState
  );
  const conversationSessionVersion = useForum(
    (state) => state.conversationSessionVersions[fixture.forumId] ?? 0
  );
  const isForumHydrated = useForum((state) => state.isHydrated);
  const restartConversationSession = useForum(
    (state) => state.restartConversationSession
  );
  const savedConversationView = useForum(
    (state) => state.savedConversationViews[fixture.forumId] ?? null
  );
  const [allPosts, setAllPosts] = useState(fixture.posts);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  return (
    <div
      className="grid gap-4 p-4"
      data-testid="playwright-conversation-harness"
    >
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded border px-3 py-2 text-sm"
          data-testid="control-open-panel"
          disabled={isPanelOpen}
          onClick={() => {
            setIsPanelOpen(true);
          }}
          type="button"
        >
          Open panel
        </button>
        <button
          className="rounded border px-3 py-2 text-sm"
          data-testid="control-close-panel"
          disabled={!isPanelOpen}
          onClick={() => {
            clearTransientConversationState();
            restartConversationSession(fixture.forumId);
            setIsPanelOpen(false);
          }}
          type="button"
        >
          Close panel
        </button>
        <span
          className="rounded border px-3 py-2 font-mono text-xs"
          data-testid="runtime-session-version"
        >
          {conversationSessionVersion}
        </span>
        <span
          className="rounded border px-3 py-2 font-mono text-xs"
          data-testid="runtime-saved-view"
        >
          {formatConversationView(savedConversationView)}
        </span>
      </div>

      {isPanelOpen ? (
        <HarnessConversationMount
          allPosts={allPosts}
          fixture={fixture}
          isForumHydrated={isForumHydrated}
          key={`${fixture.forumId}:${conversationSessionVersion}`}
          prefersReducedMotion={!!prefersReducedMotion}
          savedConversationView={savedConversationView}
          scenario={scenario}
          setAllPosts={setAllPosts}
        />
      ) : (
        <div
          className="rounded-lg border p-6 text-muted-foreground text-sm"
          data-testid="playwright-panel-closed"
        >
          Panel closed
        </div>
      )}
    </div>
  );
}

function HarnessConversationMount({
  allPosts,
  fixture,
  isForumHydrated,
  prefersReducedMotion,
  savedConversationView,
  scenario,
  setAllPosts,
}: {
  allPosts: ConversationPlaywrightFixture["posts"];
  fixture: ConversationPlaywrightFixture;
  isForumHydrated: boolean;
  prefersReducedMotion: boolean;
  savedConversationView: ForumConversationView | null;
  scenario: ConversationPlaywrightScenario;
  setAllPosts: Dispatch<SetStateAction<ConversationPlaywrightFixture["posts"]>>;
}) {
  const saveConversationView = useForum((state) => state.saveConversationView);
  const [liveWindowSize, setLiveWindowSize] = useState(() =>
    Math.min(FORUM_CONVERSATION_WINDOW, allPosts.length)
  );
  const livePosts = useMemo(
    () => getLiveWindowPosts(allPosts, liveWindowSize),
    [allPosts, liveWindowSize]
  );
  const forum = useMemo(
    () => ({
      ...fixture.forum,
      lastPostAt: allPosts.at(-1)?._creationTime ?? fixture.forum.lastPostAt,
      nextPostSequence:
        (allPosts.at(-1)?.sequence ?? fixture.forum.nextPostSequence) + 1,
      postCount: allPosts.length,
      updatedAt: allPosts.at(-1)?._creationTime ?? fixture.forum.updatedAt,
    }),
    [allPosts, fixture.forum]
  );
  const allPostsRef = useRef(allPosts);
  const depsRef = useRef({
    fetchAround: (postId: ConversationPlaywrightFixture["jumpTargetPostId"]) =>
      Promise.resolve(
        fetchFocusedWindow({
          postId,
          posts: allPostsRef.current,
        })
      ),
    fetchNewer: (postId: ConversationPlaywrightFixture["jumpTargetPostId"]) =>
      Promise.resolve(
        fetchNewerWindow({
          postId,
          posts: allPostsRef.current,
        })
      ),
    fetchOlder: (postId: ConversationPlaywrightFixture["jumpTargetPostId"]) =>
      Promise.resolve(
        fetchOlderWindow({
          postId,
          posts: allPostsRef.current,
        })
      ),
    loadLiveOlder: () => {
      setLiveWindowSize((current) =>
        loadOlderLiveWindow({
          liveWindowSize: current,
          posts: allPostsRef.current,
        })
      );
    },
    saveConversationView: (view: ForumConversationView) =>
      saveConversationView(fixture.forumId, view),
  });
  const [store] = useState(() =>
    createConversationStore({
      currentUserId: fixture.currentUserId,
      forumId: fixture.forumId,
      getDeps: () => depsRef.current,
      prefersReducedMotion,
    })
  );

  allPostsRef.current = allPosts;
  depsRef.current.saveConversationView = (view) =>
    saveConversationView(fixture.forumId, view);

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
      hasMoreBefore: livePosts.length < allPosts.length,
      posts: livePosts,
    });
  }, [allPosts.length, livePosts, store]);

  return (
    <ConversationStoreProvider store={store}>
      <div data-testid="playwright-panel-open">
        <ConversationPlaywrightPanel
          appendPostAction={() => {
            setAllPosts((current) => [
              ...current,
              appendConversationPlaywrightPost({
                currentPosts: current,
                scenario,
              }),
            ]);
          }}
          jumpTargetPostId={fixture.jumpTargetPostId}
        />
        <div className="relative h-[70vh] min-h-0 overflow-hidden rounded-lg border">
          <ForumConversationViewport />
        </div>
      </div>
    </ConversationStoreProvider>
  );
}

function formatConversationView(view: ForumConversationView | null) {
  if (!view) {
    return "null";
  }

  if (view.kind === "bottom") {
    return "bottom";
  }

  return `${view.postId}:${view.offset}`;
}
