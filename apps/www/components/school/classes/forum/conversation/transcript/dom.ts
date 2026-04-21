import type { RefObject } from "react";
import type { VirtualizerHandle } from "virtua";

/** Scrolls the transcript to the true bottom using the real scroll root when available. */
export function scrollToTranscriptBottom({
  behavior,
  handleRef,
  scrollElementRef,
}: {
  behavior: "auto" | "smooth";
  handleRef: RefObject<VirtualizerHandle | null>;
  scrollElementRef: RefObject<HTMLDivElement | null>;
}) {
  const currentScrollElement = scrollElementRef.current;

  if (currentScrollElement) {
    currentScrollElement.scrollTo({
      behavior,
      top: currentScrollElement.scrollHeight,
    });
    return;
  }

  handleRef.current?.scrollTo(handleRef.current.scrollSize);
}
