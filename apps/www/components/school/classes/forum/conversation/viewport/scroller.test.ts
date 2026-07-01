import { describe, expect, it } from "vitest";
import type { ActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import {
  createConversationTestRowsHandle,
  conversationTestFirstPost as firstPost,
  conversationTestRowIndexByPostId as rowIndexByPostId,
  conversationTestRows as rows,
  conversationTestSecondPost as secondPost,
} from "@/components/school/classes/forum/conversation/fixtures/data";
import { createViewportScroller } from "@/components/school/classes/forum/conversation/viewport/scroller";

const activeTranscript = {
  lastPostId: secondPost._id,
  postIds: [firstPost._id, secondPost._id],
  rowIndexByPostId,
  rows,
} satisfies ActiveTranscriptModel;

describe("conversation/viewport/scroller", () => {
  it("returns safe fallbacks before the virtualizer handle is ready", () => {
    const scroller = createViewportScroller({
      getHandle: () => null,
      getTranscript: () => activeTranscript,
      prefersReducedMotion: false,
    });

    expect(scroller.captureView()).toBeNull();
    expect(scroller.isViewReached({ kind: "bottom" })).toBe(false);
    expect(scroller.isViewVisible({ kind: "bottom" })).toBe(false);
    expect(scroller.measure()).toBeNull();
    expect(
      scroller.place({
        highlightPostId: null,
        view: { kind: "bottom" },
      })
    ).toBe(false);
  });

  it("measures latest state with a two-pixel bottom tolerance", () => {
    const { handle } = createConversationTestRowsHandle({
      scrollOffset: 298,
      scrollSize: 500,
      viewportSize: 200,
    });
    const scroller = createViewportScroller({
      getHandle: () => handle,
      getTranscript: () => activeTranscript,
      prefersReducedMotion: false,
    });

    expect(scroller.measure()).toMatchObject({
      bottomDistance: 2,
      hasOverflow: true,
      isAtLatest: true,
      view: { kind: "bottom" },
    });
  });

  it("keeps bottom reach aligned with the latest measurement tolerance", () => {
    const { handle } = createConversationTestRowsHandle({
      scrollOffset: 294,
      scrollSize: 500,
      viewportSize: 200,
    });
    const scroller = createViewportScroller({
      getHandle: () => handle,
      getTranscript: () => activeTranscript,
      prefersReducedMotion: false,
    });

    expect(scroller.measure()).toMatchObject({
      bottomDistance: 6,
      isAtLatest: false,
    });
    expect(scroller.isViewReached({ kind: "bottom" })).toBe(false);
  });

  it("places bottom and post targets with smooth virtualizer scroll", () => {
    const { handle, scrollToIndex } = createConversationTestRowsHandle({
      scrollOffset: 0,
    });
    const scroller = createViewportScroller({
      getHandle: () => handle,
      getTranscript: () => activeTranscript,
      prefersReducedMotion: false,
    });

    expect(
      scroller.place({
        highlightPostId: null,
        view: { kind: "bottom" },
      })
    ).toBe(true);
    expect(scrollToIndex).toHaveBeenLastCalledWith(rows.length - 1, {
      align: "end",
      offset: 0,
      smooth: true,
    });

    expect(
      scroller.place({
        align: "start",
        highlightPostId: null,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(true);
    expect(scrollToIndex).toHaveBeenLastCalledWith(
      rowIndexByPostId.get(firstPost._id),
      {
        align: "start",
        smooth: true,
      }
    );
  });

  it("places bottom at the physical scroll edge when Virtua row offsets are stale", () => {
    const lastRowIndex = rows.length - 1;
    const { handle, scrollToIndex } = createConversationTestRowsHandle({
      getItemOffset: (index) => (index === lastRowIndex ? 4310 : index * 100),
      getItemSize: (index) => (index === lastRowIndex ? 68 : 100),
      scrollOffset: 0,
      scrollSize: 7615,
      viewportSize: 789,
    });
    const scroller = createViewportScroller({
      getHandle: () => handle,
      getTranscript: () => activeTranscript,
      prefersReducedMotion: false,
    });

    expect(
      scroller.place({
        highlightPostId: null,
        view: { kind: "bottom" },
      })
    ).toBe(true);
    expect(scrollToIndex).toHaveBeenLastCalledWith(lastRowIndex, {
      align: "end",
      offset: 3237,
      smooth: true,
    });
  });

  it("places initial opening targets without smooth animation", () => {
    const { handle, scrollToIndex } = createConversationTestRowsHandle({
      scrollOffset: 0,
    });
    const scroller = createViewportScroller({
      getHandle: () => handle,
      getTranscript: () => activeTranscript,
      prefersReducedMotion: false,
    });

    expect(
      scroller.place({
        highlightPostId: null,
        motion: "instant",
        view: { kind: "bottom" },
      })
    ).toBe(true);
    expect(scrollToIndex).toHaveBeenLastCalledWith(rows.length - 1, {
      align: "end",
      offset: 0,
      smooth: false,
    });
  });

  it("rejects impossible placements and honors reduced-motion preference", () => {
    const { handle, scrollToIndex } = createConversationTestRowsHandle({
      scrollOffset: 0,
    });
    const emptyTranscript = {
      lastPostId: null,
      postIds: [],
      rowIndexByPostId: new Map(),
      rows: [],
    } satisfies ActiveTranscriptModel;
    const reducedMotionScroller = createViewportScroller({
      getHandle: () => handle,
      getTranscript: () => activeTranscript,
      prefersReducedMotion: true,
    });
    const emptyScroller = createViewportScroller({
      getHandle: () => handle,
      getTranscript: () => emptyTranscript,
      prefersReducedMotion: false,
    });

    expect(
      emptyScroller.place({
        highlightPostId: null,
        view: { kind: "bottom" },
      })
    ).toBe(false);
    expect(
      reducedMotionScroller.place({
        highlightPostId: null,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(true);
    expect(scrollToIndex).toHaveBeenLastCalledWith(
      rowIndexByPostId.get(firstPost._id),
      {
        align: "center",
        smooth: false,
      }
    );
    expect(
      reducedMotionScroller.place({
        highlightPostId: null,
        view: {
          kind: "post",
          postId: "missing_post" as typeof firstPost._id,
        },
      })
    ).toBe(false);
  });

  it("separates visible checks from reached-or-passed checks", () => {
    const { handle } = createConversationTestRowsHandle({
      scrollOffset: 350,
    });
    const scroller = createViewportScroller({
      getHandle: () => handle,
      getTranscript: () => activeTranscript,
      prefersReducedMotion: false,
    });

    expect(scroller.captureView()).toEqual({ kind: "bottom" });
    expect(scroller.isViewReached({ kind: "bottom" })).toBe(true);
    expect(
      scroller.isViewReached({ kind: "post", postId: firstPost._id })
    ).toBe(true);
    expect(
      scroller.isViewVisible({ kind: "post", postId: firstPost._id })
    ).toBe(false);
  });

  it("returns null measurement before the virtualizer has a viewport size", () => {
    const { handle } = createConversationTestRowsHandle({
      scrollOffset: 0,
      viewportSize: 0,
    });
    const scroller = createViewportScroller({
      getHandle: () => handle,
      getTranscript: () => activeTranscript,
      prefersReducedMotion: false,
    });

    expect(scroller.measure()).toBeNull();
  });
});
