/** Describes one imperative scroll target inside the virtual conversation list. */
export interface VirtualScrollToIndexOptions {
  align?: "auto" | "center" | "end" | "start";
  offset?: number;
  smooth?: boolean;
}

/** Exposes the imperative controls supported by the virtual conversation list. */
export interface VirtualConversationHandle {
  findItemIndex: (offset: number) => number;
  getDistanceFromBottom: () => number;
  getItemOffset: (index: number) => number;
  getItemSize: (index: number) => number;
  getScrollOffset: () => number;
  getViewportSize: () => number;
  isAtBottom: () => boolean;
  scrollToBottom: (smooth?: boolean) => boolean;
  scrollToIndex: (
    index: number,
    options?: VirtualScrollToIndexOptions
  ) => boolean;
}

/** Describes the initial semantic anchor for one virtual conversation session. */
export type VirtualConversationAnchor =
  | {
      kind: "bottom";
    }
  | {
      align?: VirtualScrollToIndexOptions["align"];
      index: number;
      kind: "index";
      offset?: number;
    };
