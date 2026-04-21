import type { ConversationRuntimeStore } from "@/components/school/classes/forum/conversation/store/runtime/types";

export function selectTranscriptModel(state: ConversationRuntimeStore) {
  return {
    clearScrollRequest: state.clearScrollRequest,
    forumId: state.forumId,
    handleBottomStateChange: state.handleBottomStateChange,
    handleHighlightVisiblePost: state.handleHighlightVisiblePost,
    handleSettledView: state.handleSettledView,
    hasMoreAfter: state.hasMoreAfter,
    hasMoreBefore: state.hasMoreBefore,
    highlightedPostId: state.highlightedPostId,
    isAtBottom: state.isAtBottom,
    isAtLatestEdge: state.isAtLatestEdge,
    isLoadingNewer: state.isLoadingNewer,
    isLoadingOlder: state.isLoadingOlder,
    items: state.items,
    lastPostId: state.lastPostId,
    loadNewerPosts: state.loadNewerPosts,
    loadOlderPosts: state.loadOlderPosts,
    pendingHighlightPostId: state.pendingHighlightPostId,
    postIdToIndex: state.postIdToIndex,
    scrollRequest: state.scrollRequest,
    settledConversationView: state.settledConversationView,
    timelineSessionVersion: state.timelineSessionVersion,
    transcriptVariant: state.transcriptVariant,
  };
}
