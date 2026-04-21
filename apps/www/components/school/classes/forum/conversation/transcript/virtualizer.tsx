import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { RefObject } from "react";
import { Virtualizer, type VirtualizerHandle } from "virtua";
import { TranscriptRow } from "@/components/school/classes/forum/conversation/transcript/rows";
import type { selectTranscriptModel } from "@/components/school/classes/forum/conversation/transcript/selectors";
import { FORUM_VIRTUAL_BUFFER_SIZE } from "@/components/school/classes/forum/conversation/utils/scroll-policy";
import { getConversationItemKey } from "@/components/school/classes/forum/conversation/utils/transcript";

/** Renders the real Virtua list shell for the forum transcript runtime. */
export function TranscriptVirtualizer({
  handleRef,
  highlightedPostId,
  items,
  onScroll,
  onScrollEnd,
  scrollElementRef,
  setScrollElementRef,
  shiftEnabled,
}: {
  handleRef: RefObject<VirtualizerHandle | null>;
  highlightedPostId: Id<"schoolClassForumPosts"> | null;
  items: ReturnType<typeof selectTranscriptModel>["items"];
  onScroll: () => void;
  onScrollEnd: () => boolean;
  scrollElementRef: RefObject<HTMLDivElement | null>;
  setScrollElementRef: (element: HTMLDivElement | null) => void;
  shiftEnabled: boolean;
}) {
  return (
    <div
      className="absolute inset-0 overflow-y-auto overscroll-contain"
      data-testid="virtual-conversation"
      ref={setScrollElementRef}
      style={{ overflowAnchor: "none" }}
    >
      <Virtualizer
        bufferSize={FORUM_VIRTUAL_BUFFER_SIZE}
        data={items}
        onScroll={onScroll}
        onScrollEnd={onScrollEnd}
        ref={handleRef}
        scrollRef={scrollElementRef}
        shift={shiftEnabled}
      >
        {(item) => (
          <TranscriptRow
            highlightedPostId={highlightedPostId}
            item={item}
            key={getConversationItemKey(item)}
          />
        )}
      </Virtualizer>
    </div>
  );
}
