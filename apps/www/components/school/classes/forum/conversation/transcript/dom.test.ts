import type { VirtualizerHandle } from "virtua";
import { describe, expect, it, vi } from "vitest";
import { scrollToTranscriptBottom } from "@/components/school/classes/forum/conversation/transcript/dom";

/** Creates one minimal Virtua handle for DOM fallback tests. */
function createHandle(scrollTo: (offset: number) => void) {
  const scrollBySpy = vi.fn();
  const scrollToSpy = vi.fn(scrollTo);
  const scrollToIndexSpy = vi.fn();

  return {
    handle: {
      cache: {} as VirtualizerHandle["cache"],
      findItemIndex: () => 0,
      getItemOffset: () => 0,
      getItemSize: () => 0,
      scrollBy: (offset) => {
        scrollBySpy(offset);
      },
      scrollOffset: 0,
      scrollSize: 500,
      scrollTo: scrollToSpy,
      scrollToIndex: (index, options) => {
        scrollToIndexSpy(index, options);
      },
      viewportSize: 0,
    } satisfies VirtualizerHandle,
    scrollToSpy,
  };
}

describe("conversation/transcript/dom", () => {
  it("scrolls the real transcript element to its true DOM bottom when available", () => {
    const scrollTo = vi.fn();
    const scrollElement = document.createElement("div");

    Object.defineProperty(scrollElement, "scrollHeight", {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(scrollElement, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });

    const scrollElementRef = {
      current: scrollElement,
    };
    const { handle, scrollToSpy } = createHandle((_offset) => undefined);
    const handleRef = {
      current: handle,
    };

    scrollToTranscriptBottom({
      behavior: "smooth",
      handleRef,
      scrollElementRef,
    });

    expect(scrollTo).toHaveBeenCalledWith({
      behavior: "smooth",
      top: 640,
    });
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("falls back to the Virtua handle when the DOM scroll root is not mounted yet", () => {
    const scrollToSpy = vi.fn();
    const { handle } = createHandle((offset) => {
      scrollToSpy(offset);
    });

    scrollToTranscriptBottom({
      behavior: "auto",
      handleRef: {
        current: handle,
      },
      scrollElementRef: { current: null },
    });

    expect(scrollToSpy).toHaveBeenCalledWith(500);
  });
});
