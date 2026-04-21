import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  ForumConversationView,
  ForumPost,
} from "@/components/school/classes/forum/conversation/models";
import type {
  ConversationTranscriptCommand,
  Forum,
  VirtualItem,
} from "@/components/school/classes/forum/conversation/types";
import type { BackStack } from "@/components/school/classes/forum/conversation/utils/back-stack";
import type { ConversationTimeline } from "@/components/school/classes/forum/conversation/utils/timeline";

export interface FocusedWindowResult {
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  newestPostId: Id<"schoolClassForumPosts"> | null;
  oldestPostId: Id<"schoolClassForumPosts"> | null;
  posts: ForumPost[];
}

export interface OlderWindowResult {
  hasMore: boolean;
  oldestPostId: Id<"schoolClassForumPosts"> | null;
  posts: ForumPost[];
}

export interface NewerWindowResult {
  hasMore: boolean;
  newestPostId: Id<"schoolClassForumPosts"> | null;
  posts: ForumPost[];
}

export interface ConversationRuntimeDeps {
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

export type ConversationVariant = "booting" | "focused" | "live";

export type ConversationScrollRequest =
  ConversationTranscriptCommand extends infer Request
    ? Request extends { id: number }
      ? Omit<Request, "id">
      : never
    : never;

export interface ConversationRuntimeState {
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
  pendingJumpProtectionPostId: Id<"schoolClassForumPosts"> | null;
  pendingLatestScroll: { smooth: boolean } | null;
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

export interface ConversationRuntimeActions {
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

export type ConversationRuntimeStore = ConversationRuntimeState &
  ConversationRuntimeActions;

export interface RuntimeActionContext {
  get: () => ConversationRuntimeStore;
  getDeps: () => ConversationRuntimeDeps;
  set: (updater: (state: ConversationRuntimeStore) => void) => void;
}
