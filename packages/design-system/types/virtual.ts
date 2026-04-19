import type { ScrollToIndexOpts } from "virtua";

/** Exposes the imperative controls supported by the virtual conversation list. */
export interface VirtualConversationHandle {
  findItemIndex: (offset: number) => number;
  getDistanceFromBottom: () => number;
  getItemOffset: (index: number) => number;
  getScrollOffset: () => number;
  getViewportSize: () => number;
  isAtBottom: () => boolean;
  scrollToBottom: () => void;
  scrollToIndex: (index: number, options?: ScrollToIndexOpts) => void;
}

/** Describes the initial semantic anchor for one virtual conversation session. */
export type VirtualConversationAnchor =
  | {
      kind: "bottom";
    }
  | {
      align?: ScrollToIndexOpts["align"];
      index: number;
      kind: "index";
      offset?: number;
    };
