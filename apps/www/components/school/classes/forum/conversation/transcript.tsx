import { useRef } from "react";
import { Virtualizer } from "virtua";
import type { Forum } from "@/components/school/classes/forum/conversation/data/entities";
import type { ActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import { getConversationRowKey } from "@/components/school/classes/forum/conversation/data/transcript/pages";
import { JumpBar } from "@/components/school/classes/forum/conversation/jump-bar";
import { VirtualTranscriptRow } from "@/components/school/classes/forum/conversation/transcript-row";
import {
  useControls,
  useViewport,
} from "@/components/school/classes/forum/conversation/viewport/context";

/**
 * Renders the Virtua Transcript surface for one hydrated Forum Conversation.
 *
 * References:
 * - Convex best practices:
 *   https://docs.convex.dev/understanding/best-practices/
 * - Convex collect/query pattern:
 *   https://stack.convex.dev/fully-reactive-pagination
 * - React effect guidance:
 *   https://react.dev/learn/you-might-not-need-an-effect
 * - virtua advanced chat story:
 *   https://github.com/inokawa/virtua/blob/main/stories/react/advanced/Chat.stories.tsx
 */
export function ForumConversationTranscript({
  activeTranscript,
  forum,
}: {
  activeTranscript: ActiveTranscriptModel;
  forum: Forum | undefined;
}) {
  const {
    goBack,
    goToLatest,
    handleScroll,
    handleScrollEnd,
    handleUserScrollIntent,
    setVirtualizerHandle,
  } = useControls();
  const highlightedPostId = useViewport((state) => state.highlightedPostId);
  const jumpControl = useViewport((state) => state.jumpControl);
  const touchYRef = useRef<number | null>(null);

  return (
    <>
      <div
        className="absolute inset-0 flex flex-col overflow-y-auto overscroll-contain"
        onTouchCancel={() => {
          touchYRef.current = null;
        }}
        onTouchEnd={() => {
          touchYRef.current = null;
        }}
        onTouchMove={(event) => {
          const touchY = event.touches.item(0)?.clientY ?? null;
          const previousTouchY = touchYRef.current;
          touchYRef.current = touchY;

          if (previousTouchY === null || touchY === null) {
            handleUserScrollIntent({ awayFromLatest: false });
            return;
          }

          handleUserScrollIntent({ awayFromLatest: touchY > previousTouchY });
        }}
        onTouchStart={(event) => {
          touchYRef.current = event.touches.item(0)?.clientY ?? null;
        }}
        onWheel={(event) => {
          handleUserScrollIntent({ awayFromLatest: event.deltaY < 0 });
        }}
        style={{ overflowAnchor: "none" }}
      >
        <Virtualizer
          data={activeTranscript.rows}
          onScroll={handleScroll}
          onScrollEnd={handleScrollEnd}
          ref={setVirtualizerHandle}
        >
          {(row, index) => (
            <VirtualTranscriptRow
              highlightedPostId={highlightedPostId}
              index={index}
              key={getConversationRowKey(row, forum?._id)}
              row={row}
              rows={activeTranscript.rows}
            />
          )}
        </Virtualizer>
      </div>

      <JumpBar control={jumpControl} onBack={goBack} onLatest={goToLatest} />
    </>
  );
}
