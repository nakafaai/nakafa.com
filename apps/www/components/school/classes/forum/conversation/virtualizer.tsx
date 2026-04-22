"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { memo, type RefObject } from "react";
import { Virtualizer, type VirtualizerHandle } from "virtua";
import {
  type ConversationRow,
  FORUM_VIRTUAL_BUFFER,
  getConversationRowKey,
} from "@/components/school/classes/forum/conversation/data/pages";
import { TranscriptRow } from "@/components/school/classes/forum/conversation/transcript-row";

/** Renders the Virtua transcript with the custom scroll parent required by the shell layout. */
export const ConversationVirtualizer = memo(
  ({
    forumId,
    handleRef,
    isWaitingForOlderWindow,
    onScroll,
    onScrollEnd,
    rows,
    scrollElementRef,
  }: {
    forumId: Id<"schoolClassForums">;
    handleRef: RefObject<VirtualizerHandle | null>;
    isWaitingForOlderWindow: boolean;
    onScroll: () => void;
    onScrollEnd: () => void;
    rows: ConversationRow[];
    scrollElementRef: RefObject<HTMLDivElement | null>;
  }) => (
    <div
      className="absolute inset-0 overflow-y-auto overscroll-contain"
      ref={scrollElementRef}
      // Virtua's custom scroll-parent example disables browser scroll anchoring
      // so DOM growth does not fight the virtualizer's own offset adjustments.
      style={{ overflowAnchor: "none" }}
    >
      <Virtualizer
        bufferSize={FORUM_VIRTUAL_BUFFER}
        data={rows}
        onScroll={onScroll}
        onScrollEnd={onScrollEnd}
        ref={handleRef}
        scrollRef={scrollElementRef}
        shift={isWaitingForOlderWindow}
      >
        {(row, index) => (
          <TranscriptRow
            key={getConversationRowKey(row, forumId)}
            nextRow={rows[index + 1]}
            previousRow={rows[index - 1]}
            row={row}
          />
        )}
      </Virtualizer>
    </div>
  )
);
ConversationVirtualizer.displayName = "ConversationVirtualizer";
