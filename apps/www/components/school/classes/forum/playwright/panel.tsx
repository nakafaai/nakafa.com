import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ForumConversationView } from "@/components/school/classes/forum/conversation/models";
import { useConversation } from "@/components/school/classes/forum/conversation/provider";

/** Renders the local browser controls and runtime state for the Playwright harness. */
export function ConversationPlaywrightPanel({
  appendPostAction,
  jumpTargetPostId,
}: {
  appendPostAction: () => void;
  jumpTargetPostId: Id<"schoolClassForumPosts">;
}) {
  return (
    <>
      <HarnessControls
        appendPostAction={appendPostAction}
        jumpTargetPostId={jumpTargetPostId}
      />
      <HarnessState />
    </>
  );
}

function HarnessControls({
  appendPostAction,
  jumpTargetPostId,
}: {
  appendPostAction: () => void;
  jumpTargetPostId: Id<"schoolClassForumPosts">;
}) {
  const { jumpToPostId, settledConversationView } = useConversation(
    (state) => ({
      jumpToPostId: state.jumpToPostId,
      settledConversationView: state.settledConversationView,
    })
  );

  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="rounded border px-3 py-2 text-sm"
        data-testid="control-jump-target"
        onClick={() => jumpToPostId(jumpTargetPostId)}
        type="button"
      >
        Jump target
      </button>
      <button
        className="rounded border px-3 py-2 text-sm"
        data-testid="control-jump-settled"
        disabled={settledConversationView?.kind !== "post"}
        onClick={() => {
          if (settledConversationView?.kind !== "post") {
            return;
          }

          jumpToPostId(settledConversationView.postId);
        }}
        type="button"
      >
        Jump settled
      </button>
      <button
        className="rounded border px-3 py-2 text-sm"
        data-testid="control-append-post"
        onClick={appendPostAction}
        type="button"
      >
        Append post
      </button>
    </div>
  );
}

function HarnessState() {
  const {
    canGoBack,
    isAtBottom,
    isAtLatestEdge,
    oldestLoadedPostId,
    pendingHighlightPostId,
    scrollRequestKind,
    settledConversationView,
    transcriptVariant,
  } = useConversation((state) => ({
    canGoBack: state.canGoBack,
    isAtBottom: state.isAtBottom,
    isAtLatestEdge: state.isAtLatestEdge,
    oldestLoadedPostId: state.timeline?.oldestPostId ?? null,
    pendingHighlightPostId: state.pendingHighlightPostId,
    scrollRequestKind: state.scrollRequest?.kind ?? null,
    settledConversationView: state.settledConversationView,
    transcriptVariant: state.transcriptVariant,
  }));

  return (
    <div className="grid gap-1 font-mono text-xs" data-testid="runtime-state">
      <span data-testid="runtime-can-go-back">{String(canGoBack)}</span>
      <span data-testid="runtime-is-at-bottom">{String(isAtBottom)}</span>
      <span data-testid="runtime-is-at-latest-edge">
        {String(isAtLatestEdge)}
      </span>
      <span data-testid="runtime-oldest-loaded-post-id">
        {oldestLoadedPostId ?? "null"}
      </span>
      <span data-testid="runtime-pending-highlight-post-id">
        {pendingHighlightPostId ?? "null"}
      </span>
      <span data-testid="runtime-scroll-request-kind">
        {scrollRequestKind ?? "null"}
      </span>
      <span data-testid="runtime-transcript-variant">{transcriptVariant}</span>
      <span data-testid="runtime-settled-view">
        {formatConversationView(settledConversationView)}
      </span>
    </div>
  );
}

function formatConversationView(view: ForumConversationView | null) {
  if (!view) {
    return "null";
  }

  if (view.kind === "bottom") {
    return "bottom";
  }

  return `post:${view.postId}:${view.offset}`;
}
