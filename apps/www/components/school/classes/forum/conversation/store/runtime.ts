import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { enableMapSet } from "immer";
import { createStore } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  ForumConversationView,
  ForumPost,
} from "@/components/school/classes/forum/conversation/store/forum";
import type {
  ConversationTranscriptCommand,
  Forum,
  VirtualItem,
} from "@/components/school/classes/forum/conversation/types";
import {
  type BackStack,
  type BackStackEntry,
  clearBackStack,
  peekBackView,
  popBackView,
  pushBackView,
} from "@/components/school/classes/forum/conversation/utils/back-stack";
import { createFocusedTimelineState } from "@/components/school/classes/forum/conversation/utils/focused";
import {
  buildVirtualItems,
  type UnreadCue,
} from "@/components/school/classes/forum/conversation/utils/items";
import {
  appendUniquePosts,
  type ConversationTimeline,
  createLiveTimeline,
  prependUniquePosts,
  refreshFocusedTimeline,
} from "@/components/school/classes/forum/conversation/utils/timeline";
import {
  areConversationViewsEqual,
  compareConversationViews,
} from "@/components/school/classes/forum/conversation/utils/view";

interface FocusedWindowResult {
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  newestPostId: Id<"schoolClassForumPosts"> | null;
  oldestPostId: Id<"schoolClassForumPosts"> | null;
  posts: ForumPost[];
}

interface OlderWindowResult {
  hasMore: boolean;
  oldestPostId: Id<"schoolClassForumPosts"> | null;
  posts: ForumPost[];
}

interface NewerWindowResult {
  hasMore: boolean;
  newestPostId: Id<"schoolClassForumPosts"> | null;
  posts: ForumPost[];
}

interface ConversationRuntimeDeps {
  fetchAround: (
    postId: Id<"schoolClassForumPosts">
  ) => Promise<FocusedWindowResult>;
  fetchNewer: (
    postId: Id<"schoolClassForumPosts">
  ) => Promise<NewerWindowResult>;
  fetchOlder: (
    postId: Id<"schoolClassForumPosts">
  ) => Promise<OlderWindowResult>;
  loadLiveOlder: () => void;
  saveConversationView: (view: ForumConversationView) => void;
}

type ConversationVariant = "booting" | "focused" | "live";
type ConversationScrollRequest =
  ConversationTranscriptCommand extends infer Request
    ? Request extends { id: number }
      ? Omit<Request, "id">
      : never
    : never;

interface ConversationRuntimeData {
  backStack: BackStack;
  baselineLatestPostId: Id<"schoolClassForumPosts"> | null;
  canGoBack: boolean;
  currentUserId: Id<"users">;
  focusRequestToken: number;
  forum: Forum | undefined;
  forumId: Id<"schoolClassForums">;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  hasPendingLatestPosts: boolean;
  highlightedPostId: Id<"schoolClassForumPosts"> | null;
  highlightTimeoutId: number | null;
  isAtBottom: boolean;
  isAtLatestEdge: boolean;
  isBootstrapped: boolean;
  isHydrated: boolean;
  isInitialLoading: boolean;
  isLoadingNewer: boolean;
  isLoadingOlder: boolean;
  isUnreadCueAcknowledged: boolean;
  items: VirtualItem[];
  lastPostId: Id<"schoolClassForumPosts"> | undefined;
  liveHasMoreBefore: boolean;
  liveLatestPostId: Id<"schoolClassForumPosts"> | null;
  livePosts: ForumPost[];
  pendingHighlightPostId: Id<"schoolClassForumPosts"> | null;
  pendingLatestScroll: null | {
    smooth: boolean;
  };
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
  prefersReducedMotion: boolean;
  savedConversationView: ForumConversationView | null;
  scrollRequest: ConversationTranscriptCommand | null;
  scrollRequestId: number;
  settledConversationView: ForumConversationView | null;
  timeline: ConversationTimeline | null;
  timelineSessionVersion: number;
  transcriptVariant: "focused" | "live";
  unreadPostId: Id<"schoolClassForumPosts"> | null;
  variant: ConversationVariant;
}

interface ConversationRuntimeActions {
  acknowledgeUnreadCue: () => void;
  clearScrollRequest: (requestId: number) => void;
  goBack: () => void;
  handleBottomStateChange: (isAtBottom: boolean) => void;
  handleHighlightVisiblePost: (postId: Id<"schoolClassForumPosts">) => void;
  handleSettledView: (view: ForumConversationView) => void;
  jumpToPostId: (postId: Id<"schoolClassForumPosts">) => void;
  loadNewerPosts: () => boolean;
  loadOlderPosts: () => boolean;
  scrollToLatest: () => void;
  syncForum: (forum: Forum | undefined) => void;
  syncForumStore: (payload: {
    isHydrated: boolean;
    savedConversationView: ForumConversationView | null;
  }) => void;
  syncLiveWindow: (payload: {
    hasMoreBefore: boolean;
    posts: ForumPost[];
  }) => void;
}

export type ConversationRuntimeStore = ConversationRuntimeData &
  ConversationRuntimeActions;

enableMapSet();

const FORUM_JUMP_HIGHLIGHT_DURATION = 1600;

/** Chooses how one back entry should disappear once the user reaches its origin again. */
function getBackDismissWhen(
  comparison: number | null
): BackStackEntry["dismissWhen"] {
  if (comparison === null) {
    return "exact-origin";
  }

  if (comparison < 0) {
    return "at-or-before-origin";
  }

  return "at-or-after-origin";
}

/** Returns whether the current semantic view has already reached one back origin. */
function hasReachedBackOrigin({
  comparison,
  currentView,
  entry,
}: {
  comparison: number | null;
  currentView: ForumConversationView;
  entry: BackStackEntry;
}) {
  if (comparison === null) {
    if (currentView.kind === "bottom") {
      return entry.originView.kind === "bottom";
    }

    return (
      entry.originView.kind === "post" &&
      currentView.postId === entry.originView.postId
    );
  }

  if (entry.dismissWhen === "at-or-after-origin") {
    return comparison >= 0;
  }

  if (entry.dismissWhen === "at-or-before-origin") {
    return comparison <= 0;
  }

  return comparison === 0;
}

/** Returns the unread cue still ahead of the current live baseline. */
function getLiveUnreadCue({
  baselineLatestPostId,
  isCueAcknowledged,
  posts,
  transcriptVariant,
}: {
  baselineLatestPostId: Id<"schoolClassForumPosts"> | null;
  isCueAcknowledged: boolean;
  posts: ForumPost[];
  transcriptVariant: "focused" | "live";
}) {
  if (transcriptVariant !== "live" || isCueAcknowledged) {
    return null;
  }

  let count = 0;
  let passedBaselineLatestPost = baselineLatestPostId === null;
  let postId: Id<"schoolClassForumPosts"> | null = null;

  for (const post of posts) {
    const isUnread = !passedBaselineLatestPost && post.isUnread === true;

    if (isUnread) {
      postId ??= post._id;
      count += 1;
    }

    if (post._id === baselineLatestPostId) {
      passedBaselineLatestPost = true;
    }
  }

  if (!(postId && count > 0)) {
    return null;
  }

  return {
    count,
    postId,
    status: "new",
  } satisfies UnreadCue;
}

/** Rebuilds the derived transcript state after one source field changes. */
function syncDerivedState(state: ConversationRuntimeStore) {
  const transcriptVariant = state.variant === "focused" ? "focused" : "live";
  const timeline = state.timeline;
  const unreadCue = timeline
    ? getLiveUnreadCue({
        baselineLatestPostId: state.baselineLatestPostId,
        isCueAcknowledged: state.isUnreadCueAcknowledged,
        posts: timeline.posts,
        transcriptVariant,
      })
    : null;
  const virtualItems = buildVirtualItems({
    forum: state.forum,
    isDetachedMode: transcriptVariant !== "live",
    posts: timeline?.posts ?? [],
    unreadCue,
  });

  state.canGoBack = state.backStack.length > 0;
  state.hasMoreAfter = timeline?.hasMoreAfter ?? false;
  state.hasMoreBefore = timeline?.hasMoreBefore ?? false;
  state.hasPendingLatestPosts =
    transcriptVariant === "focused" &&
    state.liveLatestPostId !== null &&
    timeline?.newestPostId !== state.liveLatestPostId;
  state.isAtLatestEdge = timeline?.isAtLatestEdge ?? false;
  state.isInitialLoading =
    !state.isBootstrapped ||
    state.timeline === null ||
    (state.variant === "live" && state.livePosts.length === 0);
  state.items = virtualItems.items;
  state.lastPostId = timeline?.posts.at(-1)?._id;
  state.postIdToIndex = virtualItems.postIdToIndex;
  state.transcriptVariant = transcriptVariant;
  state.unreadPostId = unreadCue?.postId ?? null;
}

/** Issues one semantic transcript scroll request with a monotonically increasing id. */
function issueScrollRequest(
  state: ConversationRuntimeStore,
  request: ConversationScrollRequest
) {
  state.scrollRequestId += 1;
  state.scrollRequest = {
    ...request,
    id: state.scrollRequestId,
  };
}

/** Clears the current transient jump highlight and any scheduled timeout. */
function clearHighlightState(state: ConversationRuntimeStore) {
  if (state.highlightTimeoutId !== null) {
    window.clearTimeout(state.highlightTimeoutId);
  }

  state.highlightTimeoutId = null;
  state.highlightedPostId = null;
  state.pendingHighlightPostId = null;
}

/** Prunes back-history entries that are no longer meaningful after settlement. */
function pruneReachedBackHistory(state: ConversationRuntimeStore) {
  const currentView = state.settledConversationView;

  if (!currentView) {
    return;
  }

  let nextBackStack = state.backStack;

  while (nextBackStack.length > 0) {
    const entry = peekBackView(nextBackStack);

    if (!entry) {
      break;
    }

    const comparison = compareConversationViews({
      leftView: currentView,
      postIdToIndex: state.postIdToIndex,
      rightView: entry.originView,
    });

    if (!hasReachedBackOrigin({ comparison, currentView, entry })) {
      break;
    }

    nextBackStack = nextBackStack.slice(0, -1);
  }

  state.backStack = nextBackStack;
}

/** Pushes the current settled origin into back history for a meaningful jump. */
function maybePushCurrentViewToBackStack(
  state: ConversationRuntimeStore,
  targetView: ForumConversationView
) {
  const currentView = state.settledConversationView;

  if (!currentView || areConversationViewsEqual(currentView, targetView)) {
    return;
  }

  const comparison = compareConversationViews({
    leftView: currentView,
    postIdToIndex: state.postIdToIndex,
    rightView: targetView,
  });

  state.backStack = pushBackView({
    backStack: state.backStack,
    entry: {
      dismissWhen: getBackDismissWhen(comparison),
      originView: currentView,
    },
  });
}

/** Applies one timeline window and keeps the derived shell state in sync. */
function applyTimelineWindow({
  bumpSession,
  state,
  timeline,
  variant,
}: {
  bumpSession: boolean;
  state: ConversationRuntimeStore;
  timeline: ConversationTimeline | null;
  variant: Extract<ConversationVariant, "focused" | "live">;
}) {
  state.timeline = timeline;
  state.variant = variant;

  if (bumpSession) {
    state.timelineSessionVersion += 1;
  }

  syncDerivedState(state);
}

/** Switches the runtime back to live mode and optionally requests latest scrolling. */
function showLiveTimeline({
  state,
  requestLatest,
  smooth,
  bumpSession,
}: {
  bumpSession: boolean;
  requestLatest: boolean;
  smooth: boolean;
  state: ConversationRuntimeStore;
}) {
  state.variant = "live";

  if (state.livePosts.length === 0) {
    state.pendingLatestScroll = requestLatest
      ? {
          smooth,
        }
      : null;
    state.timeline = null;
    if (bumpSession) {
      state.timelineSessionVersion += 1;
    }
    syncDerivedState(state);
    return;
  }

  state.pendingLatestScroll = null;
  applyTimelineWindow({
    bumpSession,
    state,
    timeline: createLiveTimeline(state.livePosts, state.liveHasMoreBefore),
    variant: "live",
  });

  if (requestLatest) {
    issueScrollRequest(state, {
      kind: "latest",
      smooth,
    });
  }
}

/** Creates one forum-scoped runtime store that owns timeline, navigation, and settlement state. */
export function createConversationStore({
  currentUserId,
  forumId,
  getDeps,
  prefersReducedMotion,
}: {
  currentUserId: Id<"users">;
  forumId: Id<"schoolClassForums">;
  getDeps: () => ConversationRuntimeDeps;
  prefersReducedMotion: boolean;
}) {
  return createStore<ConversationRuntimeStore>()(
    immer((set, get) => ({
      backStack: clearBackStack(),
      baselineLatestPostId: null,
      canGoBack: false,
      currentUserId,
      focusRequestToken: 0,
      forum: undefined,
      forumId,
      hasMoreAfter: false,
      hasMoreBefore: false,
      hasPendingLatestPosts: false,
      highlightedPostId: null,
      highlightTimeoutId: null,
      isAtBottom: false,
      isAtLatestEdge: false,
      isBootstrapped: false,
      isHydrated: false,
      isInitialLoading: true,
      isLoadingNewer: false,
      isLoadingOlder: false,
      isUnreadCueAcknowledged: false,
      items: [],
      lastPostId: undefined,
      liveHasMoreBefore: false,
      liveLatestPostId: null,
      livePosts: [],
      pendingHighlightPostId: null,
      pendingLatestScroll: null,
      postIdToIndex: new Map(),
      prefersReducedMotion,
      savedConversationView: null,
      scrollRequest: null,
      scrollRequestId: 0,
      settledConversationView: null,
      timeline: null,
      timelineSessionVersion: 0,
      transcriptVariant: "live",
      unreadPostId: null,
      variant: "booting",

      acknowledgeUnreadCue: () => {
        set((state) => {
          state.isUnreadCueAcknowledged = true;
          syncDerivedState(state);
        });
      },

      clearScrollRequest: (requestId) => {
        set((state) => {
          if (state.scrollRequest?.id !== requestId) {
            return;
          }

          state.scrollRequest = null;
        });
      },

      goBack: () => {
        const { entry, backStack } = popBackView(get().backStack);

        if (!entry) {
          return;
        }

        const originView = entry.originView;

        set((state) => {
          state.backStack = backStack;
          clearHighlightState(state);
          syncDerivedState(state);
        });

        if (originView.kind === "bottom") {
          get().scrollToLatest();
          return;
        }

        const currentIndex = get().postIdToIndex.get(originView.postId);

        if (currentIndex !== undefined) {
          set((state) => {
            issueScrollRequest(state, {
              kind: "restore",
              smooth: false,
              view: originView,
            });
          });
          return;
        }

        const requestToken = get().focusRequestToken + 1;

        set((state) => {
          state.focusRequestToken = requestToken;
        });

        getDeps()
          .fetchAround(originView.postId)
          .then((aroundResult) => {
            if (get().focusRequestToken !== requestToken) {
              return;
            }

            set((state) => {
              applyTimelineWindow({
                bumpSession: true,
                state,
                timeline: createFocusedTimelineState({
                  aroundResult,
                  targetKind: "restore",
                }),
                variant: "focused",
              });
              issueScrollRequest(state, {
                kind: "restore",
                smooth: false,
                view: originView,
              });
            });
          })
          .catch(() => {
            if (get().focusRequestToken !== requestToken) {
              return;
            }

            set((state) => {
              showLiveTimeline({
                bumpSession: true,
                requestLatest: false,
                smooth: false,
                state,
              });
            });
          });
      },

      handleBottomStateChange: (isAtBottom) => {
        set((state) => {
          state.isAtBottom = isAtBottom;
        });
      },

      handleHighlightVisiblePost: (postId) => {
        set((state) => {
          if (state.pendingHighlightPostId !== postId) {
            return;
          }

          if (state.highlightTimeoutId !== null) {
            window.clearTimeout(state.highlightTimeoutId);
          }

          state.pendingHighlightPostId = null;
          state.highlightedPostId = postId;
          state.highlightTimeoutId = window.setTimeout(() => {
            set((nextState) => {
              if (nextState.highlightedPostId !== postId) {
                return;
              }

              nextState.highlightTimeoutId = null;
              nextState.highlightedPostId = null;
            });
          }, FORUM_JUMP_HIGHLIGHT_DURATION);
        });
      },

      handleSettledView: (view) => {
        set((state) => {
          state.settledConversationView = view;
          pruneReachedBackHistory(state);
          syncDerivedState(state);
        });

        getDeps().saveConversationView(view);
      },

      jumpToPostId: (postId) => {
        const targetView = {
          kind: "post",
          offset: 0,
          postId,
        } satisfies ForumConversationView;
        const currentIndex = get().postIdToIndex.get(postId);

        set((state) => {
          clearHighlightState(state);
          state.pendingHighlightPostId = postId;
          maybePushCurrentViewToBackStack(state, targetView);
          syncDerivedState(state);
        });

        if (currentIndex !== undefined) {
          set((state) => {
            issueScrollRequest(state, {
              kind: "jump",
              postId,
              smooth: !state.prefersReducedMotion,
            });
          });
          return;
        }

        const requestToken = get().focusRequestToken + 1;

        set((state) => {
          state.focusRequestToken = requestToken;
        });

        getDeps()
          .fetchAround(postId)
          .then((aroundResult) => {
            if (get().focusRequestToken !== requestToken) {
              return;
            }

            set((state) => {
              applyTimelineWindow({
                bumpSession: true,
                state,
                timeline: createFocusedTimelineState({
                  aroundResult,
                  targetKind: "jump",
                }),
                variant: "focused",
              });
              issueScrollRequest(state, {
                kind: "jump",
                postId,
                smooth: !state.prefersReducedMotion,
              });
            });
          })
          .catch(() => {
            if (get().focusRequestToken !== requestToken) {
              return;
            }

            set((state) => {
              clearHighlightState(state);
              showLiveTimeline({
                bumpSession: true,
                requestLatest: false,
                smooth: false,
                state,
              });
            });
          });
      },

      loadNewerPosts: () => {
        const state = get();

        if (
          !(
            state.variant === "focused" &&
            state.timeline?.hasMoreAfter &&
            state.timeline.newestPostId &&
            !state.isLoadingNewer
          )
        ) {
          return false;
        }

        const newestPostId = state.timeline.newestPostId;

        set((draft) => {
          draft.isLoadingNewer = true;
        });

        getDeps()
          .fetchNewer(newestPostId)
          .then((newerResult) => {
            set((draft) => {
              if (!(draft.variant === "focused" && draft.timeline)) {
                draft.isLoadingNewer = false;
                return;
              }

              const nextPosts = appendUniquePosts(
                draft.timeline.posts,
                newerResult.posts
              );

              draft.timeline = {
                ...draft.timeline,
                hasMoreAfter: newerResult.hasMore,
                isAtLatestEdge: !newerResult.hasMore,
                isJumpMode: newerResult.hasMore
                  ? draft.timeline.isJumpMode
                  : false,
                newestPostId:
                  newerResult.newestPostId ?? draft.timeline.newestPostId,
                posts: nextPosts.posts,
              };
              draft.isLoadingNewer = false;
              syncDerivedState(draft);
            });
          })
          .catch(() => {
            set((draft) => {
              draft.isLoadingNewer = false;
            });
          });

        return true;
      },

      loadOlderPosts: () => {
        const state = get();

        if (!(state.timeline?.hasMoreBefore && !state.isLoadingOlder)) {
          return false;
        }

        if (state.variant === "live") {
          getDeps().loadLiveOlder();
          return true;
        }

        const oldestPostId = state.timeline.oldestPostId;

        if (!oldestPostId) {
          return false;
        }

        set((draft) => {
          draft.isLoadingOlder = true;
        });

        getDeps()
          .fetchOlder(oldestPostId)
          .then((olderResult) => {
            set((draft) => {
              if (!(draft.variant === "focused" && draft.timeline)) {
                draft.isLoadingOlder = false;
                return;
              }

              const nextPosts = prependUniquePosts(
                draft.timeline.posts,
                olderResult.posts
              );

              draft.timeline = {
                ...draft.timeline,
                hasMoreBefore: olderResult.hasMore,
                oldestPostId:
                  olderResult.oldestPostId ?? draft.timeline.oldestPostId,
                posts: nextPosts.posts,
              };
              draft.isLoadingOlder = false;
              syncDerivedState(draft);
            });
          })
          .catch(() => {
            set((draft) => {
              draft.isLoadingOlder = false;
            });
          });

        return true;
      },

      scrollToLatest: () => {
        set((state) => {
          clearHighlightState(state);
          state.backStack = clearBackStack();
          showLiveTimeline({
            bumpSession: state.variant === "focused",
            requestLatest: true,
            smooth: !state.prefersReducedMotion,
            state,
          });
        });
      },

      syncForum: (forum) => {
        set((state) => {
          state.forum = forum;
          syncDerivedState(state);
        });
      },

      syncForumStore: ({ isHydrated, savedConversationView }) => {
        const state = get();

        set((draft) => {
          draft.isHydrated = isHydrated;
          draft.savedConversationView = savedConversationView;

          if (!draft.isBootstrapped) {
            draft.settledConversationView = savedConversationView;
          }

          syncDerivedState(draft);
        });

        if (!(isHydrated && !state.isBootstrapped)) {
          return;
        }

        if (savedConversationView?.kind === "post") {
          const requestToken = state.focusRequestToken + 1;

          set((draft) => {
            draft.focusRequestToken = requestToken;
            draft.isBootstrapped = true;
            syncDerivedState(draft);
          });

          getDeps()
            .fetchAround(savedConversationView.postId)
            .then((aroundResult) => {
              if (get().focusRequestToken !== requestToken) {
                return;
              }

              set((draft) => {
                applyTimelineWindow({
                  bumpSession: true,
                  state: draft,
                  timeline: createFocusedTimelineState({
                    aroundResult,
                    targetKind: "restore",
                  }),
                  variant: "focused",
                });
                issueScrollRequest(draft, {
                  kind: "restore",
                  smooth: false,
                  view: savedConversationView,
                });
              });
            })
            .catch(() => {
              if (get().focusRequestToken !== requestToken) {
                return;
              }

              set((draft) => {
                showLiveTimeline({
                  bumpSession: true,
                  requestLatest: true,
                  smooth: false,
                  state: draft,
                });
              });
            });

          return;
        }

        set((draft) => {
          draft.isBootstrapped = true;
          showLiveTimeline({
            bumpSession: true,
            requestLatest: true,
            smooth: false,
            state: draft,
          });
        });
      },

      syncLiveWindow: ({ hasMoreBefore, posts }) => {
        set((state) => {
          state.liveHasMoreBefore = hasMoreBefore;
          state.liveLatestPostId = posts.at(-1)?._id ?? null;
          state.livePosts = posts;

          if (state.baselineLatestPostId === null && state.liveLatestPostId) {
            state.baselineLatestPostId = state.liveLatestPostId;
          }

          if (!state.isBootstrapped) {
            syncDerivedState(state);
            return;
          }

          if (state.variant === "live") {
            const requestLatest = state.pendingLatestScroll !== null;
            const smooth = state.pendingLatestScroll?.smooth ?? false;

            showLiveTimeline({
              bumpSession: state.timeline === null,
              requestLatest,
              smooth,
              state,
            });
            return;
          }

          if (state.timeline) {
            state.timeline = refreshFocusedTimeline({
              current: state.timeline,
              livePosts: posts,
            });
          }

          syncDerivedState(state);
        });
      },
    }))
  );
}
