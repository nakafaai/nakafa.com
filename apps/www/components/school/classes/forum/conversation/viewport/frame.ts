import { Effect } from "effect";
import type { RefObject } from "react";
import type { BrowserViewportScroller } from "@/components/school/classes/forum/conversation/viewport/browser";
import type { ViewportEvent } from "@/components/school/classes/forum/conversation/viewport/model";
import type { ConversationViewport } from "@/components/school/classes/forum/conversation/viewport/service";

/** Sends one event into the current Viewport service instance. */
export function dispatchViewportEvent(
  viewportRef: RefObject<ConversationViewport | null>,
  event: ViewportEvent
) {
  const viewport = viewportRef.current;

  if (!viewport) {
    return;
  }

  Effect.runSync(viewport.dispatch(event));
}

/** Measures the current scroller and forwards the result to the Viewport service. */
export function measureViewport(
  scrollerRef: RefObject<BrowserViewportScroller | null>,
  viewportRef: RefObject<ConversationViewport | null>,
  source: "frame" | "scroll"
) {
  dispatchViewportEvent(viewportRef, {
    measurement: scrollerRef.current?.measure() ?? null,
    source,
    type: "measure",
  });
}

/** Schedules one animation-frame measurement for Virtua layout changes. */
export function requestViewportMeasureFrame({
  frameRef,
  scrollerRef,
  viewportRef,
}: {
  frameRef: RefObject<number | null>;
  scrollerRef: RefObject<BrowserViewportScroller | null>;
  viewportRef: RefObject<ConversationViewport | null>;
}) {
  if (frameRef.current !== null) {
    cancelAnimationFrame(frameRef.current);
  }

  frameRef.current = requestAnimationFrame(() => {
    frameRef.current = null;
    measureViewport(scrollerRef, viewportRef, "frame");
  });
}

/** Cancels the pending animation-frame measurement. */
export function cancelViewportMeasureFrame(frameRef: RefObject<number | null>) {
  if (frameRef.current === null) {
    return;
  }

  cancelAnimationFrame(frameRef.current);
  frameRef.current = null;
}
