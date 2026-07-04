import { Effect, Stream } from "effect";
import type { RefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BrowserViewportScroller } from "@/components/school/classes/forum/conversation/viewport/browser";
import { viewportTestTranscript } from "@/components/school/classes/forum/conversation/viewport/fixture";
import {
  cancelViewportMeasureFrame,
  dispatchViewportEvent,
  measureViewport,
  requestViewportMeasureFrame,
} from "@/components/school/classes/forum/conversation/viewport/frame";
import {
  initialViewportState,
  type ViewportEvent,
  type ViewportMeasurement,
} from "@/components/school/classes/forum/conversation/viewport/model";
import type { ConversationViewport } from "@/components/school/classes/forum/conversation/viewport/service";

const measurement = {
  bottomDistance: 0,
  hasOverflow: true,
  isAtLatest: true,
  lastVisiblePostId: null,
  offset: 120,
  view: { kind: "bottom" },
} satisfies ViewportMeasurement;

/** Creates one static browser scroller fixture for frame dispatch tests. */
function createFrameScroller() {
  return {
    captureView: () => ({ kind: "bottom" }),
    getTranscript: () => viewportTestTranscript,
    isViewReached: () => true,
    isViewSettled: () => true,
    isViewVisible: () => true,
    measure: () => measurement,
    place: () => true,
  } satisfies BrowserViewportScroller;
}

describe("conversation/viewport/frame", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dispatches viewport events without synchronously running suspended effects", () => {
    const viewport = {
      changes: Stream.empty,
      dispatch: () => Effect.promise(() => Promise.resolve()),
      flushSnapshot: Effect.void,
      getState: Effect.succeed(initialViewportState),
      shutdown: Effect.void,
    } satisfies ConversationViewport;
    const viewportRef = {
      current: viewport,
    } satisfies RefObject<ConversationViewport | null>;

    expect(() =>
      dispatchViewportEvent(viewportRef, { type: "latest" })
    ).not.toThrow();
    expect(() =>
      dispatchViewportEvent({ current: null }, { type: "latest" })
    ).not.toThrow();
  });

  it("measures the scroller and forwards normalized viewport events", async () => {
    const events: ViewportEvent[] = [];
    const viewport = {
      changes: Stream.empty,
      dispatch: (event) =>
        Effect.sync(() => {
          events.push(event);
        }),
      flushSnapshot: Effect.void,
      getState: Effect.succeed(initialViewportState),
      shutdown: Effect.void,
    } satisfies ConversationViewport;
    const viewportRef = {
      current: viewport,
    } satisfies RefObject<ConversationViewport | null>;
    const scroller = createFrameScroller();

    measureViewport(
      { current: scroller } satisfies RefObject<BrowserViewportScroller | null>,
      viewportRef,
      "scroll"
    );
    measureViewport(
      { current: null } satisfies RefObject<BrowserViewportScroller | null>,
      viewportRef,
      "frame"
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(events).toEqual([
      { measurement, source: "scroll", type: "measure" },
      { measurement: null, source: "frame", type: "measure" },
    ]);
  });

  it("replaces and cancels animation-frame measurements", async () => {
    const cancelAnimationFrame = vi.fn();
    const requestAnimationFrame = vi.fn((_callback: FrameRequestCallback) => 7);
    const events: ViewportEvent[] = [];
    const viewport = {
      changes: Stream.empty,
      dispatch: (event) =>
        Effect.sync(() => {
          events.push(event);
        }),
      flushSnapshot: Effect.void,
      getState: Effect.succeed(initialViewportState),
      shutdown: Effect.void,
    } satisfies ConversationViewport;
    const scroller = createFrameScroller();
    const frameRef = { current: 5 } satisfies RefObject<number | null>;
    const viewportRef = {
      current: viewport,
    } satisfies RefObject<ConversationViewport | null>;

    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    requestViewportMeasureFrame({
      frameRef,
      scrollerRef: {
        current: scroller,
      } satisfies RefObject<BrowserViewportScroller | null>,
      viewportRef,
    });

    expect(cancelAnimationFrame).toHaveBeenCalledWith(5);
    expect(frameRef.current).toBe(7);
    const scheduledFrame = requestAnimationFrame.mock.calls[0]?.[0];

    if (!scheduledFrame) {
      throw new Error("Expected an animation frame callback.");
    }

    scheduledFrame(0);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(frameRef.current).toBeNull();
    expect(events).toEqual([{ measurement, source: "frame", type: "measure" }]);

    cancelViewportMeasureFrame(frameRef);
    requestViewportMeasureFrame({
      frameRef,
      scrollerRef: {
        current: scroller,
      } satisfies RefObject<BrowserViewportScroller | null>,
      viewportRef,
    });
    cancelViewportMeasureFrame(frameRef);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
    expect(frameRef.current).toBeNull();
  });
});
